# Why: Xcode 27's altool prints "ERROR: ... Failed to create URL for
# 'CDUploaderStateInfoResumeFilePath'" on a fresh upload (there is no resume state yet) and then
# "UPLOAD SUCCEEDED". fastlane 2.238 fails the upload on any ERROR: line even when altool exits 0,
# so the 2026-11-20 beta reached App Store Connect yet failed its job. Only that exact message, with
# exit 0 and the success banner, is forgiven; any other error still fails the lane.
module AltoolUploadResult
  RESUME_STATE_MISSING = /Failed to create URL for 'CDUploaderStateInfoResumeFilePath'/
  UPLOAD_SUCCEEDED = /UPLOAD SUCCEEDED with no errors/

  module_function

  def forgivable?(errors, lines)
    !errors.empty? &&
      errors.all? { |error| RESUME_STATE_MISSING.match?(error) } &&
      lines.any? { |line| UPLOAD_SUCCEEDED.match?(line) }
  end

  module Execute
    def execute(command, hide_output, &block)
      result = super
      return result if result || !AltoolUploadResult.forgivable?(@errors || [], @all_lines || [])

      FastlaneCore::UI.important("altool reported only its missing resume-state file after UPLOAD SUCCEEDED; treating the upload as successful.")
      @errors = []
      true
    end
  end

  def install(executor_class)
    executor_class.prepend(Execute) unless executor_class.ancestors.include?(Execute)
  end
end
