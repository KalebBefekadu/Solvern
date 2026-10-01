"use client";

import { useId, useRef, useState } from "react";
import type { FieldErrors } from "@/lib/leads/constants";

/**
 * Field error state and the ids and ARIA wiring that go with it.
 * `field(name)` returns the props for an input: id, name, aria-invalid and aria-describedby.
 * Callers take `formRef` out of the result (`const { formRef, ...f } = ...`): an object holding a ref
 * counts as a ref to the React Compiler, which would then flag every other property read during render.
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const base = useId();

  const id = (name: string) => `${base}-${name}`;
  const errorId = (name: string) => `${id(name)}-err`;

  const field = (name: string, hintId?: string) => {
    const describedBy = [errors[name] ? errorId(name) : null, hintId].filter(Boolean).join(" ");
    return { id: id(name), name, "aria-invalid": errors[name] ? true : undefined, "aria-describedby": describedBy || undefined };
  };

  const error = (name: string) =>
    errors[name] ? (
      <span className="field-error" id={errorId(name)}>
        {errors[name]}
      </span>
    ) : null;

  /** Moves focus to the first field with an error, in form order. */
  const focusFirst = (errs: FieldErrors) => {
    const form = formRef.current;
    if (!form) return;
    const names = Object.keys(errs);
    const el = Array.from(form.querySelectorAll<HTMLElement>("[name]")).find((e) => names.includes(e.getAttribute("name")!));
    el?.focus();
  };

  return { errors, setErrors, formRef, id, errorId, field, error, focusFirst };
}
