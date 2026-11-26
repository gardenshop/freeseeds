export function paymentReceivedText(amountPkr: number, orderNumber: string, locale: "en" | "ur"): string {
  if (!Number.isSafeInteger(amountPkr) || amountPkr <= 0 || !orderNumber.trim()) throw new Error("PAYMENT_CONFIRMATION_DATA_INVALID");
  const amount = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(amountPkr);
  return locale === "ur"
    ? `ادائیگی موصول ہو گئی\n\nآپ کی ${amount} روپے کی پیشگی ادائیگی موصول ہو گئی ہے اور اس کی تصدیق کر دی گئی ہے۔\n\nآرڈر نمبر: ${orderNumber}\n\nآپ کے آرڈر کی تصدیق ہو گئی ہے۔ ٹریکنگ کی تفصیلات دستیاب ہوتے ہی آپ کو بھیج دی جائیں گی۔`
    : `Payment Received\n\nYour advance payment of Rs. ${amount} has been received and verified.\n\nOrder Number: ${orderNumber}\n\nYour order is confirmed. Your tracking details will be shared once available.`;
}
