Pod::Spec.new do |s|
  s.name           = 'PrivacyCover'
  s.version        = '1.0.0'
  s.summary        = 'The app-switcher cover'
  s.description    = 'A window in the brand colours over everything while the app is not active.'
  s.license        = 'UNLICENSED'
  s.author         = 'Aimtrue'
  s.homepage       = 'https://example.invalid'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
