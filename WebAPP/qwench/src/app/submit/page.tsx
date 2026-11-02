"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { StepProgress } from "@/components/submit/StepProgress";
import { StepIntro } from "@/components/submit/StepIntro";
import { StepType } from "@/components/submit/StepType";
import { StepSource } from "@/components/submit/StepSource";
import { StepDetails } from "@/components/submit/StepDetails";
import { StepReview } from "@/components/submit/StepReview";
import { Button } from "@/components/ui/Button";

function SubmitForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTarget = searchParams.get("target") ?? "";
  const stepParam = parseInt(searchParams.get("step") ?? "1", 10);
  const step = Math.min(Math.max(stepParam, 1), 5);

  const [name, setName] = useState(initialTarget.replace(/-/g, " "));
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [details, setDetails] = useState("");

  function goTo(s: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("step", String(s));
    router.push(`/submit?${sp.toString()}`);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text-primary mb-2">
        Submit a Report
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Help protect others by reporting suspicious investments.
      </p>

      <StepProgress currentStep={step} totalSteps={5} />

      {step === 1 && <StepIntro value={name} onChange={setName} />}
      {step === 2 && <StepType value={type} onChange={setType} />}
      {step === 3 && <StepSource value={source} onChange={setSource} />}
      {step === 4 && <StepDetails value={details} onChange={setDetails} />}
      {step === 5 && (
        <StepReview name={name} type={type} source={source} details={details} />
      )}

      <div className="flex justify-between mt-8">
        {step > 1 ? (
          <Button variant="outline" onClick={() => goTo(step - 1)}>
            Back
          </Button>
        ) : (
          <div />
        )}
        {step < 5 ? (
          <Button onClick={() => goTo(step + 1)}>Next</Button>
        ) : (
          <Button onClick={() => alert("Report submitted! Thank you.")}>
            Submit Report
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SubmitPage() {
  return (
    <Suspense>
      <SubmitForm />
    </Suspense>
  );
}
