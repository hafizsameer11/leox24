import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Credential {
  id: number;
  email: string;
  password: string;
  project?: {
    id: number;
    name: string;
    slug: string;
  };
}

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: Credential[];
  projectName: string;
  externalUrl?: string;
  onOpenExternal?: () => void;
}

export default function CredentialsModal({
  isOpen,
  onClose,
  credentials,
  projectName,
  externalUrl,
  onOpenExternal,
}: CredentialsModalProps) {
  const { t } = useTranslation();
  const [copiedEmail, setCopiedEmail] = useState<number | null>(null);
  const [copiedPassword, setCopiedPassword] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: 'email' | 'password', id: number) => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(id);
      setTimeout(() => setCopiedEmail(null), 2000);
    } else {
      setCopiedPassword(id);
      setTimeout(() => setCopiedPassword(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink">{t('credentialsModal.projectCredentials')}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-ink mb-4">{projectName}</h3>

          {credentials.length > 0 ? (
            <div className="space-y-4">
              {credentials.map((cred) => (
                <div key={cred.id} className="bg-gray-50 rounded-lg p-4 border border-line">
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-muted uppercase">{t('credentialsModal.email')}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={cred.email}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink font-mono"
                      />
                      <button
                        onClick={() => handleCopy(cred.email, 'email', cred.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          copiedEmail === cred.id
                            ? 'bg-green-100 text-green-800'
                            : 'bg-aqua-1/30 text-aqua-5 hover:bg-aqua-1/50'
                        }`}
                      >
                        {copiedEmail === cred.id ? t('credentialsModal.copiedCheck') : t('common.copy')}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted uppercase">{t('credentialsModal.password')}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="password"
                        value={cred.password}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink font-mono"
                      />
                      <button
                        onClick={() => handleCopy(cred.password, 'password', cred.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          copiedPassword === cred.id
                            ? 'bg-green-100 text-green-800'
                            : 'bg-aqua-1/30 text-aqua-5 hover:bg-aqua-1/50'
                        }`}
                      >
                        {copiedPassword === cred.id ? t('credentialsModal.copiedCheck') : t('common.copy')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted">
              <p>{t('credentialsModal.noCredentialsFound')}</p>
            </div>
          )}
        </div>

        {externalUrl && onOpenExternal && (
          <div className="mb-4">
            <button
              onClick={onOpenExternal}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              🔗 {t('common.openLoginPage')}
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-2 border border-line text-ink rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
