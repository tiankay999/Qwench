import PaymentCheckPage from "./screen";

// Behind a login and rendered in the browser, so there's nothing to prerender.
export const instant = false;

export default function Page() {
  return <PaymentCheckPage />;
}
