import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AudioLines, ArrowUpRight, Shield } from 'lucide-react';
import { api, inr } from '../lib/api';
export default function TipPage({ slug }: { slug: string }) {
  const [creator, setCreator] = useState<any>(),
    [amount, setAmount] = useState(100),
    [text, setText] = useState(''),
    [reference, setReference] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`/v1/public/creators/${encodeURIComponent(slug)}`)
      .then(setCreator)
      .catch((e) => setStatus(e.message));
  }, [slug]);
  const uri = creator?.upiId
    ? 'upi://pay?' +
      new URLSearchParams({
        pa: creator.upiId,
        pn: creator.displayName,
        am: amount.toFixed(2),
        cu: 'INR',
        tn: 'Stream support',
      })
    : '';
  return (
    <main className="public-page">
      <a className="brand" href="/">
        <span className="brand-mark">
          <AudioLines size={22} />
        </span>
        TipRelay
      </a>
      <div className="public-card">
        <div className="creator-avatar">{(creator?.displayName || 'T')[0]}</div>
        <span className="eyebrow">A LITTLE LOVE GOES A LONG WAY</span>
        <h1>Support {creator?.displayName || 'this creator'}.</h1>
        <p>Make their next stream a little brighter.</p>
        <div className="amount-options">
          {[50, 100, 250, 500].map((n) => (
            <button key={n} onClick={() => setAmount(n)} className={amount === n ? 'selected' : ''}>
              {inr(n * 100)}
            </button>
          ))}
        </div>
        <label>
          Amount in INR
          <input
            type="number"
            min="1"
            max="100000"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        {uri && amount >= 1 && amount <= 100000 ? (
          <>
            <div className="qr">
              <QRCodeSVG value={uri} size={176} />
            </div>
            <a href={uri} className="button primary full">
              Pay {inr(Math.round(amount * 100))} with UPI <ArrowUpRight size={17} />
            </a>
            <small className="upi-id">{creator.upiId}</small>
          </>
        ) : (
          <div className="notice">
            {creator?.upiId ? 'Enter a valid amount.' : 'This creator has not configured UPI yet.'}
          </div>
        )}
        <div className="divider" />
        <h3>Leave a little encouragement</h3>
        <p className="muted">
          After paying, add the 12-digit UPI reference from your payment receipt. Messages are
          reviewed before speech.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/v1/public/creators/${encodeURIComponent(slug)}/messages`, 'POST', {
                text,
                amountPaise: Math.round(amount * 100),
                ...(reference ? { transactionReference: reference } : {}),
              });
              setStatus('Message submitted for review. This does not confirm your payment.');
              setText('');
            } catch (e) {
              setStatus((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Your message
            <textarea
              required
              maxLength={240}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Thanks for the great streams!"
            />
            <small>{text.length}/240 characters</small>
          </label>
          <label>
            UPI transaction reference (optional)
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{12}"
              placeholder="12-digit reference"
            />
          </label>
          <button disabled={busy || !creator?.upiId} className="button dark full">
            Send for review
          </button>
        </form>
        {status && (
          <div role="status" className="notice">
            {status}
          </div>
        )}
        <div className="safety-note">
          <Shield size={18} />
          <span>
            Payment goes directly to the creator. TipRelay observes phone notifications and does not
            verify settlement.
          </span>
        </div>
      </div>
      <footer>Powered by TipRelay · Direct support, real moments.</footer>
    </main>
  );
}
