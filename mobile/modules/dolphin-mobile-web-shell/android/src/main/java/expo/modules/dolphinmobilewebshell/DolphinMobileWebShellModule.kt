package expo.modules.dolphinmobilewebshell

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DolphinMobileWebShellModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DolphinMobileWebShell")

    View(DolphinMobileWebShellView::class) {
      Events("onLoadState", "onBridgeMessage", "onExternalNavigation")

      Prop("generationDirectory") { view: DolphinMobileWebShellView, value: String ->
        view.setGenerationDirectory(value)
      }

      Prop("sessionId") { view: DolphinMobileWebShellView, value: String ->
        view.setSessionId(value)
      }

      Prop("bridgeEnabled") { view: DolphinMobileWebShellView, value: Boolean ->
        view.setBridgeEnabled(value)
      }

      AsyncFunction("postBridgeMessage") { view: DolphinMobileWebShellView, json: String ->
        view.postBridgeMessage(json)
      }

      OnViewDidUpdateProps { view: DolphinMobileWebShellView ->
        view.propsDidUpdate()
      }

      OnViewDestroys { view: DolphinMobileWebShellView ->
        view.destroyWebView()
      }
    }
  }
}
