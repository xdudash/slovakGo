import XCTest

final class IPhoneExperienceTests: XCTestCase {
    private func capture(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Screenshots")
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? app.screenshot().pngRepresentation.write(to: folder.appendingPathComponent(name + ".png"))
    }

    // Run only against IOS_UI_TEST=1 builds in a Simulator. No real account/data.
    func testLearnerScreens() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "sk.slovakgo.app")
        app.launch()
        XCTAssertTrue(app.links["Profile"].waitForExistence(timeout: 20))
        capture("01-path", app: app)
        app.links["Words"].tap()
        capture("02-vocabulary", app: app)
        app.links["Practice"].tap()
        capture("03-practice", app: app)
        app.links["Profile"].tap()
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 10))
        capture("04-profile", app: app)
        app.buttons["Settings"].tap()
        XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 10))
        capture("05-settings", app: app)
        app.swipeUp()
        capture("06-settings-notifications", app: app)
        app.swipeUp()
        capture("07-settings-preferences", app: app)
    }

    func testKeyboardAndLesson() {
        let app = XCUIApplication(bundleIdentifier: "sk.slovakgo.app")
        app.launch()
        XCTAssertTrue(app.links["Profile"].waitForExistence(timeout: 20))
        app.links["Profile"].tap()
        app.buttons["Settings"].tap()
        app.textFields["Name"].tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        capture("10-keyboard", app: app)
        app.terminate()
        app.launch()
        // Scene restoration can reopen Settings on a compact iPhone.
        XCTAssertTrue(app.links["Path"].waitForExistence(timeout: 20))
        app.links["Path"].tap()
        XCTAssertTrue(app.buttons["Continue"].firstMatch.waitForExistence(timeout: 20))
        app.buttons["Continue"].firstMatch.tap()
        capture("11-lesson", app: app)
    }

    func testGhostActionTheme() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "sk.slovakgo.app")
        app.launch()
        XCTAssertTrue(app.links["Profile"].waitForExistence(timeout: 20))
        app.links["Profile"].tap()
        app.buttons["Settings"].tap()
        let change = app.buttons["Change password"].firstMatch
        for _ in 0..<8 {
            if change.exists && change.isHittable && change.frame.maxY < app.frame.height - 120 { break }
            app.swipeUp()
        }
        XCTAssertTrue(change.waitForExistence(timeout: 10))
        change.tap()
        XCTAssertTrue(app.secureTextFields["Current password"].waitForExistence(timeout: 5))
        let cancel = app.buttons["Cancel"].firstMatch
        for _ in 0..<5 {
            if cancel.exists && cancel.isHittable && cancel.frame.maxY < app.frame.height - 120 { break }
            app.swipeUp()
        }
        XCTAssertTrue(cancel.waitForExistence(timeout: 5))
        capture("12-ghost-cancel", app: app)
        cancel.tap()
        XCTAssertFalse(app.secureTextFields["Current password"].exists)
        app.links["Profile"].tap()
        let signOut = app.buttons["Sign out"].firstMatch
        for _ in 0..<8 {
            if signOut.exists && signOut.isHittable && signOut.frame.maxY < app.frame.height - 120 { break }
            app.swipeUp()
        }
        XCTAssertTrue(signOut.waitForExistence(timeout: 5))
        signOut.tap()
        XCTAssertTrue(app.buttons["Cancel"].waitForExistence(timeout: 5))
        capture("13-native-dialog", app: app)
        app.buttons["Cancel"].tap()
        XCTAssertTrue(app.links["Profile"].exists)
    }

    func testReminderPermissionAndDelivery() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "sk.slovakgo.app")
        app.launch()
        XCTAssertTrue(app.links["Profile"].waitForExistence(timeout: 20))
        app.links["Profile"].tap()
        app.buttons["Settings"].tap()
        let reminders = app.switches["Reminders"]
        for _ in 0..<4 where !reminders.isHittable { app.swipeUp() }
        XCTAssertTrue(reminders.waitForExistence(timeout: 5))
        if reminders.value as? String != "1" {
            reminders.tap()
            let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            let allow = springboard.buttons["Allow"]
            if allow.waitForExistence(timeout: 5) { allow.tap() }
        }
        let test = app.buttons["Test notification"]
        for _ in 0..<3 where !test.isHittable { app.swipeUp() }
        XCTAssertTrue(test.waitForExistence(timeout: 10))
        test.tap()
        capture("08-reminder-scheduled", app: app)
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        XCTAssertTrue(springboard.staticTexts["SlovakGO — you’re all set!"].waitForExistence(timeout: 12))
        capture("09-native-notification", app: springboard)
    }

    // Run separately on the connected iPhone with the normal development build.
    // Takes a screenshot only; does not log out or modify the user's account.
    func testPhysicalPhoneLaunch() {
        let app = XCUIApplication(bundleIdentifier: "sk.slovakgo.app")
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        capture("physical-iphone-launch", app: app)
    }
}
