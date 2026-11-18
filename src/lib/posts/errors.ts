/** Errors the social layer may show to a signed-in student as-is. */
export class SocialError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "social_error",
  ) {
    super(message);
    this.name = "SocialError";
  }
}

export const NOT_AVAILABLE = new SocialError("This post isn't available.", 404, "not_available");
