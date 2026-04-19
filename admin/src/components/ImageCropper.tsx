import { useRef, useState } from 'react'
import { Modal } from 'antd'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import type { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageCropperProps {
  open: boolean
  src: string | null
  onCancel: () => void
  onCrop: (blob: Blob) => void
  aspect?: number
}

export function ImageCropper({ open, src, onCancel, onCrop, aspect = 1 }: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [busy, setBusy] = useState(false)

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    const initial = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
      width,
      height
    )
    setCrop(initial)
  }

  const handleOk = async () => {
    if (!imgRef.current || !completedCrop) return
    setBusy(true)
    try {
      const blob = await cropToBlob(imgRef.current, completedCrop)
      onCrop(blob)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={busy}
      width={720}
      title="Кадрирование"
      okText="Готово"
      cancelText="Отмена"
      destroyOnClose
    >
      {src && (
        <div style={{ display: 'flex', justifyContent: 'center', maxHeight: '70vh', overflow: 'auto' }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            keepSelection
          >
            <img
              ref={imgRef}
              src={src}
              alt="crop"
              onLoad={onImageLoad}
              style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block' }}
            />
          </ReactCrop>
        </div>
      )}
    </Modal>
  )
}

async function cropToBlob(img: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const scaleX = img.naturalWidth / img.width
  const scaleY = img.naturalHeight / img.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(crop.width * scaleX)
  canvas.height = Math.round(crop.height * scaleY)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d ctx')
  ctx.drawImage(
    img,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png', 0.95)
  )
}
