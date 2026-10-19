/** 응답 상태 코드와 함께 던지는 오류. upstream이면 LLM 공급자 쪽에서 난 오류 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly upstream = false,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
