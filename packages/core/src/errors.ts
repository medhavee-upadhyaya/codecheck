/**
 * errors.ts — Custom error classes for CodeCheck.
 * Use the `code` property for programmatic error handling.
 */

export class CodeCheckError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message)
    this.name = 'CodeCheckError'
  }
}

/** Thrown when a file type is not supported by any extractor */
export class UnsupportedFileTypeError extends CodeCheckError {
  constructor(filePath: string, extension: string) {
    super(
      `Unsupported file type "${extension}" for file: ${filePath}. ` +
        `Supported extensions: .ts, .tsx, .js, .jsx, .py`,
      'UNSUPPORTED_FILE_TYPE'
    )
    this.name = 'UnsupportedFileTypeError'
  }
}

/** Thrown when the LLM API call fails (network, auth, rate limit, etc.) */
export class LLMApiError extends CodeCheckError {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(`LLM API error: ${message}`, 'LLM_API_ERROR')
    this.name = 'LLMApiError'
  }
}

/** Thrown when the LLM returns a response that doesn't match our schema */
export class LLMParseError extends CodeCheckError {
  constructor(
    message: string,
    public readonly rawResponse: string
  ) {
    super(`Failed to parse LLM response: ${message}`, 'LLM_PARSE_ERROR')
    this.name = 'LLMParseError'
  }
}

/** Thrown when the test runner (jest/pytest) crashes unexpectedly */
export class TestRunnerError extends CodeCheckError {
  constructor(
    message: string,
    public readonly exitCode: number
  ) {
    super(`Test runner error (exit ${exitCode}): ${message}`, 'TEST_RUNNER_ERROR')
    this.name = 'TestRunnerError'
  }
}

/** Thrown when the configuration file is invalid or missing required fields */
export class ConfigError extends CodeCheckError {
  constructor(message: string) {
    super(`Configuration error: ${message}`, 'CONFIG_ERROR')
    this.name = 'ConfigError'
  }
}

/** Thrown when code extraction fails for a file */
export class ExtractionError extends CodeCheckError {
  constructor(filePath: string, cause: string) {
    super(`Failed to extract targets from ${filePath}: ${cause}`, 'EXTRACTION_ERROR')
    this.name = 'ExtractionError'
  }
}
