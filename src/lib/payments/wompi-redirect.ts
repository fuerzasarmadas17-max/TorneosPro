// Builds the post-payment return URL. Wompi's WAF blocks any redirect-url
// containing "localhost"/"127.0.0.1" (anti-SSRF) → 403, so local testing needs
// a public URL. Set NEXT_PUBLIC_APP_URL (e.g. an ngrok https URL) to override
// window.location.origin; in production it falls back to the real origin.
export function paymentReturnUrl(reference: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    window.location.origin;
  return `${origin}/tournaments/payment-return?ref=${encodeURIComponent(reference)}`;
}

// Redirects the browser to Wompi's hosted Web Checkout by submitting an HTML
// GET form — exactly as Wompi documents. Building the URL by hand and using
// location.assign sends a literal ":" in `signature:integrity`, which the
// CloudFront WAF in front of checkout.wompi.co blocks (403). A real form lets
// the browser percent-encode the field name (":" -> "%3A"), which Wompi accepts.
export function redirectToWompiCheckout(params: {
  publicKey: string;
  amountInCents: number;
  reference: string;
  integrity: string;
  redirectUrl: string;
}) {
  const fields: Record<string, string> = {
    "public-key": params.publicKey,
    currency: "COP",
    "amount-in-cents": String(params.amountInCents),
    reference: params.reference,
    "signature:integrity": params.integrity,
    "redirect-url": params.redirectUrl,
  };

  const form = document.createElement("form");
  form.method = "GET";
  form.action = "https://checkout.wompi.co/p/";

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
