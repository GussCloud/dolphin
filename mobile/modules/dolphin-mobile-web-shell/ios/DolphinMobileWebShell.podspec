Pod::Spec.new do |s|
  s.name = 'DolphinMobileWebShell'
  s.version = '0.0.1'
  s.summary = 'WebView shell that serves one generation directory from a private origin'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Dolphin'
  s.homepage = 'https://dolphin.guss.dev.br'
  s.source = { :git => 'https://github.com/GussCloud/dolphin.git' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
