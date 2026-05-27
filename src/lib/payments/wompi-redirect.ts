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
