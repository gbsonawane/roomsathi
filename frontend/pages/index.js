import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { sendOtp, verifyOtp, devLogin } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/home");
    }
  }, [user, router]);

  const isValidContact = phone.trim().length > 0;

  const handleSendOtp = async () => {
    if (!isValidContact) {
      setError("Enter a valid phone number or email.");
      return;
    }
    setError("");
    setSending(true);
    try {
      const data = await sendOtp(phone.trim());
      if (data?.dev_otp) {
        setDevOtp(data.dev_otp);
      }
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError("Enter the OTP to continue.");
      return;
    }
    setError("");
    setSending(true);
    try {
      const auth = await verifyOtp(phone.trim(), otp.trim(), name.trim() || undefined);
      await login(auth);
      router.push("/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDevLogin = async () => {
    if (!isValidContact) {
      setError("Enter a valid phone number or email.");
      return;
    }
    setError("");
    setSending(true);
    try {
      const auth = await devLogin(phone.trim(), name.trim() || "Test User");
      await login(auth);
      router.push("/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 className="page-title">Welcome to RoomSathi</h1>
      <p style={{ marginTop: 0, color: "#475569" }}>
        Sign in with phone or email to browse rentals and connect directly with owners.
      </p>

      <div style={{ marginTop: 24 }}>
        <label>Mobile number or email</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +919876543210 or user@example.com"
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
        />
      </div>

      {step === 2 && (
        <div style={{ marginTop: 16 }}>
          <label>OTP code</label>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter 6-digit OTP"
          />
          {devOtp && (
            <p style={{ margin: "12px 0 0", color: "#0f766e" }}>
              Dev OTP: <strong>{devOtp}</strong>
            </p>
          )}
        </div>
      )}

      {error && <p style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
        {step === 1 ? (
          <button className="primary" onClick={handleSendOtp} disabled={sending}>
            {sending ? "Sending…" : "Send OTP"}
          </button>
        ) : (
          <button className="primary" onClick={handleVerifyOtp} disabled={sending}>
            {sending ? "Verifying…" : "Verify OTP"}
          </button>
        )}

        <button className="outline" onClick={handleDevLogin} disabled={sending}>
          {sending ? "Logging in…" : "Dev login"}
        </button>
      </div>
    </div>
  );
}
