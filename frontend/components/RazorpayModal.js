import { useEffect } from "react";

export default function RazorpayModal({
  amount,
  orderId,
  keyId,
  onSuccess,
  onFailure,
  isOpen,
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function initializePayment() {
      const loaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!loaded) {
        onFailure("Failed to load Razorpay SDK. Check your internet connection.");
        onClose();
        return;
      }

      if (!keyId) {
        onFailure("Razorpay Key ID is missing");
        onClose();
        return;
      }

      const options = {
        key: keyId,
        amount: amount, // Amount in paise
        currency: "INR",
        name: "RoomSathi",
        description: "Room & Roommate Finder Pune",
        image: "https://cdn-icons-png.flaticon.com/512/25/25694.png", // fallback placeholder/icon
        order_id: orderId,
        handler: function (response) {
          if (isMounted) {
            onSuccess(response.razorpay_payment_id, response.razorpay_signature);
            onClose();
          }
        },
        prefill: {
          name: "",
          email: "",
          contact: "",
        },
        theme: {
          color: "#065f46", // Brand green
        },
        modal: {
          ondismiss: function () {
            if (isMounted) {
              onFailure("Payment cancelled by user");
              onClose();
            }
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    }

    initializePayment();

    return () => {
      isMounted = false;
    };
  }, [isOpen, amount, orderId, keyId]);

  return null;
}

function loadScript(src) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
