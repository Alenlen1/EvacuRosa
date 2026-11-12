import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// Only these known parser failures receive a client-error status. Never expose
// an arbitrary thrown message, even if it includes status/expose properties.
const bodyErrors: Record<string, { status: number; message: string }> = {
  "entity.parse.failed": {
    status: 400,
    message:
      "The request contains invalid JSON. Please check it and try again.",
  },
  "entity.too.large": {
    status: 413,
    message: "The request is too large. Please reduce its size and try again.",
  },
  "charset.unsupported": {
    status: 415,
    message: "The request uses an unsupported text encoding.",
  },
  "encoding.unsupported": {
    status: 415,
    message: "The request uses an unsupported content encoding.",
  },
  "request.aborted": {
    status: 400,
    message: "The request was interrupted. Please try again.",
  },
  "request.size.invalid": {
    status: 400,
    message: "The request could not be read. Please try again.",
  },
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // A streaming response may already be in progress. Let Express close it
  // rather than attempting to write another response or change its headers.
  if (res.headersSent) {
    _next(err);
    return;
  }
  const referenceId = randomUUID();
  const details = err as { type?: unknown; status?: unknown } | null;
  const type = typeof details?.type === "string" ? details.type : "";
  const knownBodyError = Object.hasOwn(bodyErrors, type)
    ? bodyErrors[type]
    : undefined;
  const bodyError =
    knownBodyError?.status === details?.status ? knownBodyError : undefined;
  const status = bodyError?.status ?? 500;

  console.error("Backend request failed", {
    referenceId,
    status,
    // Parser errors can include passwords/contact details in both body and
    // message. Log only their type, never the original payload or request.
    error: bodyError
      ? { type }
      : err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { name: "UnknownError" },
  });
  const message =
    bodyError?.message ??
    "We could not complete your request. Please try again.";
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({
    error: `${message} Reference: ${referenceId}`,
    referenceId,
  });
}
