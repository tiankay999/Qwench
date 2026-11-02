"use client";

import { useState } from "react";
import { IDENTIFIER_TYPES, guessType } from "@/lib/console";
import { Button, Field, inputClass } from "./ui";

export type IdentifierValue = { recipient: string; type: string; amount: string; newPayee: boolean };

/** One identifier, with its type guessed as you type. A choice you make sticks. */
export function IdentifierForm({
  label,
  placeholder,
  submitLabel,
  busy,
  withPayment,
  initial,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  withPayment?: boolean;
  initial?: Partial<IdentifierValue>;
  onSubmit: (value: IdentifierValue) => void;
}) {
  const [recipient, setRecipient] = useState(initial?.recipient || "");
  const [type, setType] = useState(initial?.type || "momo_number");
  const [typeChosen, setTypeChosen] = useState(false);
  const [amount, setAmount] = useState(initial?.amount || "");
  const [newPayee, setNewPayee] = useState(initial?.newPayee ?? true);

  function changeRecipient(value: string) {
    setRecipient(value);
    if (!typeChosen) setType(guessType(value) || "momo_number");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ recipient: recipient.trim(), type, amount, newPayee });
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label={label} htmlFor="recipient">
          <input id="recipient" required autoComplete="off" value={recipient} placeholder={placeholder} onChange={(e) => changeRecipient(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Type" htmlFor="type">
          <select
            id="type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setTypeChosen(true);
            }}
            className={inputClass}
          >
            {IDENTIFIER_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {withPayment && (
        <div className="grid items-end gap-4 sm:grid-cols-[12rem_1fr]">
          <Field label="Amount (GHS)" htmlFor="amount">
            <input id="amount" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </Field>
          <label htmlFor="new-payee" className="flex min-h-10 items-center gap-2 text-sm text-text-primary">
            <input id="new-payee" type="checkbox" checked={newPayee} onChange={(e) => setNewPayee(e.target.checked)} className="size-4 accent-mid-navy" />
            This is a new payee
          </label>
        </div>
      )}

      <Button type="submit" disabled={busy || !recipient.trim()}>
        {busy ? "Checking…" : submitLabel}
      </Button>
    </form>
  );
}
