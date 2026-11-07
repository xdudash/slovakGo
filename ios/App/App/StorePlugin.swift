import Capacitor
import StoreKit

/// StoreKit 2 bridge for SlovakGO Plus. The app never decides access itself:
/// every transaction goes to the server as Apple's signed JWS, and is finished
/// only after the server has stored it.
@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "SlovakGoStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
    ]

    private var updatesTask: Task<Void, Never>?

    override public func load() {
        // Renewals, Ask to Buy approvals and purchases made on another device.
        updatesTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                self?.notifyListeners("transaction", data: Self.payload(result), retainUntilConsumed: true)
            }
        }
    }

    deinit { updatesTask?.cancel() }

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                var items: [JSObject] = []
                for product in try await Product.products(for: ids) {
                    items.append(await Self.describe(product))
                }
                call.resolve(["products": items])
            } catch {
                call.reject("Could not load App Store products", nil, error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"),
              let token = call.getString("appAccountToken").flatMap(UUID.init(uuidString:)) else {
            return call.reject("productId and appAccountToken are required")
        }
        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    return call.reject("Product not found", "PRODUCT_NOT_FOUND")
                }
                let options: Set<Product.PurchaseOption> = [.appAccountToken(token)]
                let result: Product.PurchaseResult
                if #available(iOS 17.0, *), let scene = self.bridge?.viewController?.view.window?.windowScene {
                    result = try await product.purchase(confirmIn: scene, options: options)
                } else {
                    result = try await product.purchase(options: options)
                }
                switch result {
                case .success(let verification):
                    var data = Self.payload(verification)
                    data["status"] = "purchased"
                    call.resolve(data)
                case .pending:
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                @unknown default:
                    call.resolve(["status": "cancelled"])
                }
            } catch {
                call.reject(error.localizedDescription, "PURCHASE_FAILED", error)
            }
        }
    }

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        Task { call.resolve(["transactions": await Self.entitlements()]) }
    }

    /// "Restore purchases": asks the App Store to resync, which may show an Apple ID sign-in.
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["transactions": await Self.entitlements()])
            } catch {
                call.reject(error.localizedDescription, "RESTORE_FAILED", error)
            }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        guard let id = call.getString("transactionId").flatMap(UInt64.init) else {
            return call.reject("transactionId is required")
        }
        Task {
            for await result in Transaction.unfinished where result.unsafePayloadValue.id == id {
                await result.unsafePayloadValue.finish()
            }
            call.resolve()
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                return call.reject("No active window")
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject(error.localizedDescription, "MANAGE_FAILED", error)
            }
        }
    }

    // MARK: - Helpers

    private static func payload(_ result: VerificationResult<Transaction>) -> JSObject {
        ["jws": result.jwsRepresentation, "transactionId": String(result.unsafePayloadValue.id)]
    }

    private static func entitlements() async -> [JSObject] {
        var items: [JSObject] = []
        for await result in Transaction.currentEntitlements where result.unsafePayloadValue.productType == .autoRenewable {
            items.append(payload(result))
        }
        return items
    }

    private static func period(_ period: Product.SubscriptionPeriod) -> JSObject {
        let unit: String
        switch period.unit {
        case .day: unit = "day"
        case .week: unit = "week"
        case .month: unit = "month"
        case .year: unit = "year"
        @unknown default: unit = "month"
        }
        return ["unit": unit, "value": period.value]
    }

    private static func describe(_ product: Product) async -> JSObject {
        var item: JSObject = [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "price": NSDecimalNumber(decimal: product.price).doubleValue,
            "currencyCode": product.priceFormatStyle.currencyCode,
        ]
        if let subscription = product.subscription {
            item["period"] = period(subscription.subscriptionPeriod)
            if let offer = subscription.introductoryOffer,
               await subscription.isEligibleForIntroOffer {
                item["introOffer"] = [
                    "paymentMode": offer.paymentMode == .freeTrial ? "freeTrial" : offer.paymentMode == .payAsYouGo ? "payAsYouGo" : "payUpFront",
                    "displayPrice": offer.displayPrice,
                    "period": period(offer.period),
                    "periodCount": offer.periodCount,
                ] as JSObject
            }
        }
        return item
    }
}
