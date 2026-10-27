/**
 * @file components/common/AvatarUpload.tsx
 * @description User avatar uploader & manager (POST /api/v1/users/me/avatar & DELETE /api/v1/users/me/avatar).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Popconfirm, Tooltip, Upload, App as AntApp, Spin } from 'antd';
import { CameraOutlined, DeleteOutlined, LoadingOutlined, UserOutlined } from '@ant-design/icons';
import { userApi } from '@/services/api/userApi';
import { useAuthStore, getAvatarImageUrl, getInitials } from '@/stores/authStore';
import { getApiErrorMessage } from '@/services/apiClient';

interface AvatarUploadProps {
  size?: number;
  className?: string;
  showActions?: boolean;
  statusColor?: string;
  statusLabel?: string;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  size = 80,
  className = '',
  showActions = true,
  statusColor,
  statusLabel = 'Trạng thái hồ sơ',
}) => {
  const { message } = AntApp.useApp();
  const { user, updateUser, syncCurrentUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const avatarUrl = getAvatarImageUrl(user?.avatar);
  const hasCustomAvatar = Boolean(avatarUrl);
  const initials = getInitials(user?.name || user?.email || 'User');
  const displayedAvatar = useMemo(
    () => previewUrl || avatarUrl || null,
    [avatarUrl, previewUrl]
  );

  useEffect(() => {
    setImageFailed(false);
  }, [displayedAvatar]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleUpload = async (file: File) => {
    if (loading) return false;
    // Validate file type
    const isValidType = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type);
    if (!isValidType) {
      message.error('Chỉ chấp nhận tập tin ảnh định dạng JPG, PNG hoặc WEBP!');
      return false;
    }

    // Validate size (max 5MB)
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('Kích thước ảnh tối đa là 5MB!');
      return false;
    }

    try {
      const nextPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextPreviewUrl;
      });
      setLoading(true);
      const res = await userApi.uploadAvatar(file);
      message.success(res.message || 'Cập nhật ảnh đại diện thành công!');
      if (res.data?.avatarUrl) {
        updateUser({ avatar: res.data.avatarUrl });
      }
      await syncCurrentUser();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể tải lên ảnh đại diện!'));
    } finally {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setLoading(false);
    }

    return false; // prevent default antd upload behavior
  };

  const handleDelete = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await userApi.deleteAvatar();
      message.success(res.message || 'Đã xóa ảnh đại diện thành công!');
      updateUser({ avatar: initials });
      await syncCurrentUser();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể xóa ảnh đại diện!'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative group" style={{ width: size, height: size }}>
        <div
          className="rounded-full overflow-hidden border-2 border-white shadow-md flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          {loading ? (
            <Spin indicator={<LoadingOutlined style={{ fontSize: size * 0.35, color: '#fff' }} spin />} />
          ) : displayedAvatar && !imageFailed ? (
            <img
              src={displayedAvatar}
              alt={user?.name || 'Avatar'}
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span>{initials}</span>
          )}
          {statusColor && (
            <span
              role="status"
              aria-label={statusLabel}
              title={statusLabel}
              className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-solid border-white shadow-sm"
              style={{ backgroundColor: statusColor }}
            />
          )}
        </div>

        {/* Quick hover trigger */}
        {!loading && (
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            accept=".jpg,.jpeg,.png,.webp"
            disabled={loading}
          >
            <Tooltip title="Đổi ảnh đại diện">
              <button
                type="button"
                className="absolute inset-0 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity duration-200 border-0"
                aria-label="Tải ảnh mới"
                disabled={loading}
              >
                <CameraOutlined style={{ fontSize: size * 0.28 }} />
              </button>
            </Tooltip>
          </Upload>
        )}
      </div>

      {showActions && (
        <div className="flex items-center gap-2">
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            accept=".jpg,.jpeg,.png,.webp"
            disabled={loading}
          >
            <Button
              size="small"
              icon={<CameraOutlined />}
              loading={loading}
              className="text-xs"
            >
              Đổi ảnh
            </Button>
          </Upload>

          {hasCustomAvatar && (
            <Popconfirm
              title="Xóa ảnh đại diện?"
              description="Bạn có chắc chắn muốn xóa ảnh đại diện và quay về chữ cái đại diện mặc định?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={handleDelete}
              disabled={loading}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={loading}
                className="text-xs"
              >
                Xóa
              </Button>
            </Popconfirm>
          )}
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
