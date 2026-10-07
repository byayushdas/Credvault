import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Field } from "./UI";

export type VaultScanResult = {
  vault_id?: string;
  token?: string;
  source: "QR" | "MANUAL" | "QR_SHARE";
};

interface QrScannerProps {
  onScan: (result: VaultScanResult) => void;
  onCancel: () => void;
}

export function QrScanner({ onScan, onCancel }: QrScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [manualId, setManualId] = useState("");
  const [scannedVaultId, setScannedVaultId] = useState("");
  const [scannedToken, setScannedToken] = useState("");
  const scannerInstance = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!scannerRef.current || scannedVaultId || scannedToken) return;

    scannerInstance.current = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerInstance.current.render(
      (decodedText) => {
        try {
          const url = new URL(decodedText);
          if (url.protocol !== "credvault:") throw new Error("Invalid scheme");
          if (url.hostname === "vault") {
            const vaultId = url.pathname.replace(/^\//, "");
            if (!/^CV-[0-9a-fA-F-]{36}$/.test(vaultId)) throw new Error("Invalid Vault ID");
            setScannedVaultId(vaultId);
          } else if (url.hostname === "share") {
            const token = url.pathname.replace(/^\//, "");
            if (!token) throw new Error("Invalid Token");
            setScannedToken(token);
          } else {
            throw new Error("Invalid format");
          }
          scannerInstance.current?.clear();
        } catch (err) {
          setError("Invalid QR code format. Scan a valid CredVault owner or share QR.");
        }
      },
      (err) => {
        // Ignore normal scan errors (happens every frame it doesn't see a QR)
      }
    );

    return () => {
      scannerInstance.current?.clear().catch(e => console.error(e));
    };
  }, [scannedVaultId, scannedToken]);

  const handleManualSubmit = () => {
    if (!/^CV-[0-9a-fA-F-]{36}$/.test(manualId)) {
      setError("Vault ID must start with CV- followed by a valid identifier");
      return;
    }
    onScan({ vault_id: manualId, source: "MANUAL" });
  };

  return (
    <div className="card">
      <h2>Scan the owner's CredVault QR</h2>
      
      {scannedVaultId ? (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#10b981', fontWeight: 'bold' }}>
            ✓ Vault identified
          </div>
          <p>Vault ID: <code className="reference">{scannedVaultId}</code></p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <button className="primary" onClick={() => onScan({ vault_id: scannedVaultId, source: "QR" })}>
              Continue
            </button>
            <button className="secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : scannedToken ? (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#10b981', fontWeight: 'bold' }}>
            ✓ Share token identified
          </div>
          <p>Temporary share token captured</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <button className="primary" onClick={() => onScan({ token: scannedToken, source: "QR_SHARE" })}>
              Continue
            </button>
            <button className="secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}
          <div id="qr-reader" ref={scannerRef} style={{ width: "100%", maxWidth: "500px", margin: "0 auto", overflow: "hidden", borderRadius: "8px" }} />
          
          <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
            <h3>Or enter manually</h3>
            <div>
              <Field label="Vault ID">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    value={manualId} 
                    onChange={e => setManualId(e.target.value)} 
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (manualId) handleManualSubmit();
                      }
                    }}
                    placeholder="CV-..." 
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={handleManualSubmit} className="primary" disabled={!manualId}>Submit</button>
                </div>
              </Field>
            </div>
          </div>
        </>
      )}
      
      {(!scannedVaultId && !scannedToken) && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}
