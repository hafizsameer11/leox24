import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';

interface MediaItem {
  id: number;
  url: string;
  name: string;
  size?: number;
  type?: 'image' | 'video';
  mimeType?: string;
  created_at?: string;
}

interface MediaLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function MediaLibrary({ isOpen, onClose, onSelect }: MediaLibraryProps) {
  const { t } = useTranslation();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMediaItems();
    }
  }, [isOpen]);

  const fetchMediaItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/media');
      const items = Array.isArray(response.data) ? response.data : [];
      
      const validItems = items
        .filter((item: any) => {
          return item.url && (item.url.startsWith('http://') || item.url.startsWith('https://') || item.url.startsWith('/'));
        })
        .map((item: any) => ({
          ...item,
          name: typeof item.name === 'string' ? item.name : (item.name?.toString() || t('mediaLibrary.defaultImageName')),
        }));
      
      setMediaItems(validItems);
    } catch (error: any) {
      console.error('Failed to fetch media items:', error);
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (response.data?.url) {
        const imageUrl = response.data.url;
        await fetchMediaItems();
        setSelectedUrl(imageUrl);
        setTimeout(() => {
          handleSelect(imageUrl);
        }, 500);
      }
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      alert(error.response?.data?.message || t('mediaLibrary.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        handleFileUpload(file);
      } else {
        alert(t('mediaLibrary.invalidFileType'));
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelect = (url: string) => {
    setSelectedUrl(url);
    onSelect(url);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('mediaLibrary.title')}
      size="xl"
    >
      <div className="space-y-4">
        <div className="border border-line rounded-lg p-4 bg-gray-50">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="media-upload"
            />
            <label
              htmlFor="media-upload"
              className="px-4 py-2 bg-aqua-5 text-white rounded-lg hover:bg-aqua-4 transition-colors cursor-pointer font-medium"
            >
              {uploading ? t('mediaLibrary.uploading') : t('mediaLibrary.uploadMedia')}
            </label>
            <p className="text-sm text-muted">
              {t('mediaLibrary.uploadHintSelect')}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : mediaItems.length === 0 ? (
          <div className="text-center py-12 text-muted">
            {t('mediaLibrary.noMediaFound')}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
            {mediaItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item.url)}
                className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                  selectedUrl === item.url
                    ? 'border-aqua-5 ring-2 ring-aqua-5/20'
                    : 'border-line hover:border-aqua-4'
                }`}
              >
                <div className="aspect-square bg-gray-100 relative">
                  {item.type === 'video' || item.url.match(/\.(mp4|webm|ogg|mov|avi)$/i) ? (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    >
                      {t('mediaLibrary.videoNotSupported')}
                    </video>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.name || t('mediaLibrary.defaultImageName')}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                      onLoad={(e) => {
                        (e.target as HTMLImageElement).style.display = 'block';
                      }}
                    />
                  )}
                  {(item.type === 'video' || item.url.match(/\.(mp4|webm|ogg|mov|avi)$/i)) && (
                    <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                      {t('mediaLibrary.video')}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2">
                  <p className="text-xs truncate">{item.name}</p>
                </div>
                {selectedUrl === item.url && (
                  <div className="absolute top-2 right-2 bg-aqua-5 text-white rounded-full p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-line">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {selectedUrl && (
            <Button onClick={() => handleSelect(selectedUrl)}>
              {t('common.useSelectedImage')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
