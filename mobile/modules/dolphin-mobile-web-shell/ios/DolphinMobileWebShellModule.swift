import ExpoModulesCore

public class DolphinMobileWebShellModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DolphinMobileWebShell")

    View(DolphinMobileWebShellView.self) {
      Events("onLoadState", "onBridgeMessage", "onExternalNavigation")

      Prop("generationDirectory") { (view: DolphinMobileWebShellView, value: String) in
        view.setGenerationDirectory(value)
      }

      Prop("sessionId") { (view: DolphinMobileWebShellView, value: String) in
        view.setSessionId(value)
      }

      Prop("bridgeEnabled") { (view: DolphinMobileWebShellView, value: Bool) in
        view.setBridgeEnabled(value)
      }

      AsyncFunction("postBridgeMessage") {
        (view: DolphinMobileWebShellView, json: String, promise: Promise) in
        try view.postBridgeMessage(json, promise: promise)
      }

      OnViewDidUpdateProps { (view: DolphinMobileWebShellView) in
        view.propsDidUpdate()
      }
    }
  }
}
