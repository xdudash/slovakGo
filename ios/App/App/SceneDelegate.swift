import UIKit
import Capacitor

/// Brand purple shared by the launch screen and the web boot splash.
let launchPurple = UIColor(red: 90 / 255, green: 69 / 255, blue: 214 / 255, alpha: 1)

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = launchPurple
        window?.rootViewController = NativeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

class NativeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorePlugin())
        bridge?.registerPluginInstance(AppleSignInPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
        webView?.scrollView.keyboardDismissMode = .interactive
        // Purple shows through until the page paints its boot splash, so launch
        // never flashes black or grey. Overscroll uses the page's own background.
        view.backgroundColor = launchPurple
        webView?.backgroundColor = .clear
        webView?.scrollView.backgroundColor = .clear
        webView?.isOpaque = false
        if #available(iOS 26.0, *) {
            // The web layout already protects status/tab bars with safe-area insets.
            webView?.scrollView.topEdgeEffect.isHidden = true
            webView?.scrollView.bottomEdgeEffect.isHidden = true
        }
    }
}
