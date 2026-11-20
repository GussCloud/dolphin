require "minitest/autorun"
require "fastlane_core"
require_relative "altool_upload_result"

# Runs fastlane's real AltoolTransporterExecutor; only the altool process is replaced, by the
# output the Xcode 27.2 runner printed in Release Beta run 44759791855 (2026-11-20).
class AltoolUploadResultTest < Minitest::Test
  RESUME_ERROR = "2026-11-20 15:39:38.441 ERROR: [ContentDelivery.Uploader.7CF4C75700] Failed to create URL for 'CDUploaderStateInfoResumeFilePath'. The file doesn’t exist. (4) The file doesn’t exist.\n".freeze
  SUCCEEDED_RUN = [
    "Running altool at path '/Applications/Xcode_27.2.app/Contents/SharedFrameworks/ContentDelivery.framework/Resources/altool'...\n",
    RESUME_ERROR,
    "2026-11-20 15:39:38.445  INFO: [ContentDelivery.Uploader.7CF4C75700] \n",
    "==========================================\n",
    "UPLOAD SUCCEEDED with no errors\n",
    "Delivery UUID: 56fd467b-f2cd-4343-a830-aa21a0ad968e\n",
    "Transferred 24118574 bytes in 2.919 seconds (8.3MB/s, 66.099Mbps)\n",
    "==========================================\n",
  ].freeze

  AltoolUploadResult.install(FastlaneCore::AltoolTransporterExecutor)

  def run_altool(lines, exit_status: 0)
    pty = FastlaneCore::FastlanePty.singleton_class
    pty.alias_method(:original_spawn, :spawn)
    pty.define_method(:spawn) do |_command, &block|
      block.call(lines.each, nil, 0)
      exit_status
    end
    executor = FastlaneCore::AltoolTransporterExecutor.new
    [executor.execute("altool --upload-app", true), executor.errors]
  ensure
    pty.alias_method(:spawn, :original_spawn)
    pty.remove_method(:original_spawn)
  end

  def test_upload_that_succeeded_despite_the_resume_state_error_passes
    result, errors = run_altool(SUCCEEDED_RUN)

    assert_equal(true, result)
    assert_empty(errors)
  end

  def test_resume_state_error_without_the_success_banner_still_fails
    result, = run_altool(SUCCEEDED_RUN.grep_v(/UPLOAD SUCCEEDED/))

    assert_equal(false, result)
  end

  def test_non_zero_exit_still_fails
    result, = run_altool(SUCCEEDED_RUN, exit_status: 1)

    assert_equal(false, result)
  end

  def test_any_other_error_still_fails
    lines = SUCCEEDED_RUN + ["ERROR: [ContentDelivery.Uploader] The bundle version must be higher than the previously uploaded version.\n"]
    result, errors = run_altool(lines)

    assert_equal(false, result)
    assert_equal(2, errors.length)
  end
end
