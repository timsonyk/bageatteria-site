import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  Upload,
  message,
  Card,
  Spin,
} from 'antd'
import { HolderOutlined, EditOutlined, DeleteOutlined, SettingOutlined, ShopOutlined, ScissorOutlined } from '@ant-design/icons'
import { ImageCropper } from '../../components/ImageCropper'
import type { UploadFile } from 'antd/es/upload/interface'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const fetchProducts = async () => (await api.get('/admin/products')).data
const fetchCategories = async () => (await api.get('/admin/categories')).data
const fetchSizes = async (productId?: number) =>
  (await api.get('/admin/product_sizes', { params: productId ? { product_id: productId } : {} })).data
const fetchStoreLocations = async () => (await api.get('/admin/store_locations')).data

const API_HOST = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000'

/** Для отображения в админке: относительный путь превращаем в полный URL. */
function toDisplayUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http')) return url
  return `${API_HOST}${url}`
}

/** Для сохранения в БД: храним только относительный путь /uploads/xxx. */
function toStoredUrl(url: string): string {
  if (!url) return url
  if (url.startsWith(API_HOST)) return url.slice(API_HOST.length)
  const m = url.match(/\/uploads\/[^?#]+/)
  return m ? m[0] : url
}
const fetchProductAvailability = async (productId: number) =>
  (await api.get('/admin/product_availability', { params: { product_id: productId } })).data

interface Product {
  id: number
  name: string
  category_id: number
  base_price: number
  sort_order: number
  is_active: boolean
  media?: string[]
  size_label?: string
  [key: string]: any
}

interface Category {
  id: number
  name: string
  unit?: string
  sort_order: number
  is_active: boolean
}

// Sortable product row component
function SortableProductRow({
  product,
  onEdit,
  onSizes,
  onAvailability,
  onDelete,
  onToggleActive,
}: {
  product: Product
  onEdit: (p: Product) => void
  onSizes: (p: Product) => void
  onAvailability: (p: Product) => void
  onDelete: (id: number) => void
  onToggleActive: (p: Product, active: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const imageUrl = product.media?.[0]
  const fullImageUrl = imageUrl ? toDisplayUrl(imageUrl) : null

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        opacity: isDragging ? 0.5 : 1,
        borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        cursor: 'default',
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', opacity: 0.5, display: 'flex', alignItems: 'center' }}
      >
        <HolderOutlined style={{ fontSize: 16 }} />
      </div>

      {fullImageUrl ? (
        <img
          src={fullImageUrl}
          alt=""
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: 48, height: 48, background: 'var(--ant-color-fill-tertiary, #f5f5f5)', borderRadius: 6, flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <Typography.Text strong ellipsis style={{ display: 'block' }}>
          {product.name}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {product.base_price} ₽ {product.size_label && `· ${product.size_label}`}
        </Typography.Text>
      </div>

      <Switch
        checked={product.is_active}
        size="small"
        onChange={(checked) => onToggleActive(product, checked)}
      />

      <Space size={4}>
        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(product)} />
        <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => onSizes(product)} />
        <Button type="text" size="small" icon={<ShopOutlined />} onClick={() => onAvailability(product)} />
        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(product.id)} />
      </Space>
    </div>
  )
}

// Category group component with sortable products
function CategoryGroup({
  category,
  products,
  onReorder,
  onEdit,
  onSizes,
  onAvailability,
  onDelete,
  onToggleActive,
}: {
  category: Category
  products: Product[]
  onReorder: (categoryId: number, newOrder: Product[]) => void
  onEdit: (p: Product) => void
  onSizes: (p: Product) => void
  onAvailability: (p: Product) => void
  onDelete: (id: number) => void
  onToggleActive: (p: Product, active: boolean) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = products.findIndex((p) => p.id === active.id)
      const newIndex = products.findIndex((p) => p.id === over.id)
      const newOrder = arrayMove(products, oldIndex, newIndex)
      onReorder(category.id, newOrder)
    }
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{category.name}</span>
          <span style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>({products.length})</span>
        </div>
      }
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 0 } }}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {products.map((product) => (
            <SortableProductRow
              key={product.id}
              product={product}
              onEdit={onEdit}
              onSizes={onSizes}
              onAvailability={onAvailability}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
            />
          ))}
        </SortableContext>
      </DndContext>
      {products.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Нет товаров в этой категории</div>
      )}
    </Card>
  )
}

export const ProductsPage = () => {
  const qc = useQueryClient()
  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: fetchProducts })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const [form] = Form.useForm()
  const selectedCategoryId = Form.useWatch('category_id', form)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const cropResolverRef = useRef<{
    resolve: (blob: Blob) => void
    reject: () => void
  } | null>(null)

  const openCropper = (src: string) =>
    new Promise<Blob>((resolve, reject) => {
      cropResolverRef.current = { resolve, reject }
      setCropSrc(src)
    })

  const closeCropper = (blob?: Blob) => {
    const r = cropResolverRef.current
    cropResolverRef.current = null
    setCropSrc(null)
    if (!r) return
    if (blob) r.resolve(blob)
    else r.reject()
  }

  const uploadBlob = async (blob: Blob, name = `cropped-${Date.now()}.png`) => {
    const formData = new FormData()
    formData.append('file', blob, name)
    const res = await api.post('/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.url as string
  }
  const [searchQuery, setSearchQuery] = useState('')

  // Local state for optimistic reordering
  const [localProducts, setLocalProducts] = useState<Product[]>([])

  // Sync local products with server data
  useEffect(() => {
    if (products) {
      setLocalProducts(products)
    }
  }, [products])

  const [sizesOpen, setSizesOpen] = useState(false)
  const [currentProductId, setCurrentProductId] = useState<number | null>(null)
  const sizesQuery = useQuery({
    queryKey: ['product_sizes', currentProductId],
    queryFn: () => fetchSizes(currentProductId || undefined),
    enabled: !!currentProductId,
  })
  const [sizeForm] = Form.useForm()

  // Store availability
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [availabilityProductId, setAvailabilityProductId] = useState<number | null>(null)
  const { data: storeLocations } = useQuery({ queryKey: ['store_locations'], queryFn: fetchStoreLocations })
  const availabilityQuery = useQuery({
    queryKey: ['product_availability', availabilityProductId],
    queryFn: () => fetchProductAvailability(availabilityProductId!),
    enabled: !!availabilityProductId,
  })
  const [selectedStores, setSelectedStores] = useState<number[]>([])

  // Sorted categories
  const sortedCategories = useMemo(() => {
    if (!categories) return []
    return [...categories].sort((a: Category, b: Category) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }, [categories])

  // Get selected category unit
  const selectedCategoryUnit = useMemo(() => {
    if (!selectedCategoryId || !categories) return null
    const cat = categories.find((c: Category) => c.id === selectedCategoryId)
    return cat?.unit || null
  }, [selectedCategoryId, categories])

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return localProducts
    const query = searchQuery.toLowerCase().trim()
    return localProducts.filter((p) => p.name.toLowerCase().includes(query))
  }, [localProducts, searchQuery])

  // Group products by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<number, Product[]> = {}
    for (const cat of sortedCategories) {
      grouped[cat.id] = []
    }
    for (const product of filteredProducts) {
      if (grouped[product.category_id]) {
        grouped[product.category_id].push(product)
      }
    }
    // Sort products within each category by sort_order
    for (const catId of Object.keys(grouped)) {
      grouped[Number(catId)].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }
    return grouped
  }, [filteredProducts, sortedCategories])

  const saveProduct = useMutation({
    mutationFn: async (values: any) => {
      if (editing) return api.put(`/admin/products/${editing.id}`, values)
      return api.post('/admin/products', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
  })

  const saveSortOrder = useMutation({
    mutationFn: async (items: { id: number; sort_order: number }[]) => {
      return api.post('/admin/products/bulk_sort', { items })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: () => {
      message.error('Не удалось сохранить порядок')
      // Revert to server state
      if (products) setLocalProducts(products)
    },
  })

  const saveSize = useMutation({
    mutationFn: async (values: any) => {
      if (values.id) {
        const { id, ...rest } = values
        return api.put(`/admin/product_sizes/${id}`, rest)
      }
      return api.post('/admin/product_sizes', { ...values, product_id: currentProductId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product_sizes', currentProductId] })
      sizeForm.resetFields()
    },
  })

  const deleteSize = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/product_sizes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product_sizes', currentProductId] }),
  })

  const deleteProduct = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const saveAvailability = useMutation({
    mutationFn: async (payload: { product_id: number; store_location_ids: number[] }) =>
      api.post('/admin/product_availability/bulk', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product_availability', availabilityProductId] })
      message.success('Доступность сохранена')
      setAvailabilityOpen(false)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Не удалось сохранить доступность')
    },
  })

  const handleReorder = useCallback(
    (categoryId: number, newOrder: Product[]) => {
      // Update local state immediately (optimistic)
      setLocalProducts((prev) => {
        const otherProducts = prev.filter((p) => p.category_id !== categoryId)
        const updatedProducts = newOrder.map((p, idx) => ({ ...p, sort_order: idx }))
        return [...otherProducts, ...updatedProducts]
      })

      // Save to server
      const items = newOrder.map((p, idx) => ({ id: p.id, sort_order: idx }))
      saveSortOrder.mutate(items)
    },
    [saveSortOrder]
  )

  const handleEdit = useCallback(
    (product: Product) => {
      setEditing(product)
      form.resetFields()
      form.setFieldsValue(product)
      if (product.media && Array.isArray(product.media)) {
        setFileList(
          product.media.map((url: string, idx: number) => ({
            uid: `${idx}`,
            name: url.split('/').pop() || `изображение-${idx}`,
            status: 'done' as const,
            url: toDisplayUrl(url),
          }))
        )
      } else {
        setFileList([])
      }
      setOpen(true)
    },
    [form]
  )

  const handleSizes = useCallback((product: Product) => {
    setCurrentProductId(product.id)
    setSizesOpen(true)
  }, [])

  const handleAvailability = useCallback((product: Product) => {
    setAvailabilityProductId(product.id)
    setAvailabilityOpen(true)
  }, [])

  const handleDelete = useCallback(
    (id: number) => {
      deleteProduct.mutate(id)
    },
    [deleteProduct]
  )

  const handleToggleActive = useCallback(
    (product: Product, active: boolean) => {
      api.put(`/admin/products/${product.id}`, { ...product, is_active: active }).then(() => {
        qc.invalidateQueries({ queryKey: ['products'] })
      })
    },
    [qc]
  )

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ is_active: true, sort_order: 0 })
    setFileList([])
    setOpen(true)
  }

  const sizeColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Объём', dataIndex: 'volume', render: (v: string) => v || '—' },
    { title: 'Цена', dataIndex: 'base_price', render: (v: number) => `${v} ₽` },
    { title: 'Сорт.', dataIndex: 'sort_order', width: 60 },
    {
      title: 'Действия',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" onClick={() => sizeForm.setFieldsValue(record)}>
            Редактировать
          </Button>
          <Button danger size="small" onClick={() => deleteSize.mutate(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  useEffect(() => {
    if (!sizesOpen) {
      setCurrentProductId(null)
      sizeForm.resetFields()
    }
  }, [sizesOpen, sizeForm])

  useEffect(() => {
    if (availabilityOpen && availabilityQuery.data) {
      setSelectedStores(availabilityQuery.data.map((a: any) => a.store_location_id))
    }
  }, [availabilityOpen, availabilityQuery.data])

  useEffect(() => {
    if (!availabilityOpen) {
      setAvailabilityProductId(null)
      setSelectedStores([])
    }
  }, [availabilityOpen])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} align="center">
        <Button type="primary" onClick={openCreate}>
          Новый товар
        </Button>
        <Input.Search
          placeholder="Поиск по названию..."
          allowClear
          style={{ width: 300 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Space>

      {!searchQuery ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Перетаскивайте товары для изменения порядка
        </Typography.Text>
      ) : (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Найдено: {filteredProducts.length} {filteredProducts.length === 1 ? 'товар' : filteredProducts.length < 5 ? 'товара' : 'товаров'}
        </Typography.Text>
      )}

      {sortedCategories.map((category: Category) => {
        const categoryProducts = productsByCategory[category.id] || []
        // Скрываем пустые категории при поиске
        if (searchQuery && categoryProducts.length === 0) return null
        return (
          <CategoryGroup
            key={category.id}
          category={category}
          products={productsByCategory[category.id] || []}
          onReorder={handleReorder}
          onEdit={handleEdit}
          onSizes={handleSizes}
          onAvailability={handleAvailability}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
        />
        )
      })}

      <Modal
        open={open}
        title={editing ? 'Редактировать товар' : 'Новый товар'}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveProduct.isPending}
        destroyOnClose
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ is_active: true, sort_order: 0 }}
          onFinish={(values) => {
            const mediaUrls = fileList
              .map((f) => (f.response as any)?.url || f.url)
              .filter(Boolean)
              .map(toStoredUrl)
            const payload = { ...values, media: mediaUrls }
            if (payload.weight != null) payload.weight = String(payload.weight)
            saveProduct.mutate(payload)
          }}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category_id" label="Категория" rules={[{ required: true }]}>
            <Select options={(categories || []).map((c: any) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="base_price" label="Базовая цена" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="size_label" label="Подпись размера (если нет размеров)">
            <Input placeholder="S / M / L / XL" />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item
              name="weight"
              label={selectedCategoryUnit ? `Вес / Объём (${selectedCategoryUnit})` : "Вес / Объём"}
              style={{ flex: 1 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                placeholder={selectedCategoryUnit ? `Введите число` : "400"}
                addonAfter={selectedCategoryUnit || undefined}
              />
            </Form.Item>
            <Form.Item name="calories" label="Калории (ккал)" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="713" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="proteins" label="Белки (г)" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="12.5" />
            </Form.Item>
            <Form.Item name="fats" label="Жиры (г)" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="8.3" />
            </Form.Item>
            <Form.Item name="carbs" label="Углеводы (г)" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="45.2" />
            </Form.Item>
          </Space>
          <Form.Item name="ingredients" label="Состав">
            <Input.TextArea rows={2} placeholder="Мука, сахар, молоко, яйца..." />
          </Form.Item>
          <Form.Item label="Изображения">
            <Upload.Dragger
              name="file"
              multiple
              fileList={fileList}
              beforeUpload={async (file) => {
                const objectUrl = URL.createObjectURL(file as Blob)
                try {
                  const blob = await openCropper(objectUrl)
                  URL.revokeObjectURL(objectUrl)
                  const cropped = new File([blob], (file as File).name.replace(/\.[^.]+$/, '') + '.jpg', {
                    type: 'image/jpeg',
                  })
                  return cropped
                } catch {
                  URL.revokeObjectURL(objectUrl)
                  return Upload.LIST_IGNORE as any
                }
              }}
              customRequest={async (options) => {
                const { file, onError, onSuccess } = options
                try {
                  const rawUrl = await uploadBlob(file as Blob, (file as File).name)
                  const url = toDisplayUrl(rawUrl)
                  onSuccess?.({ url: rawUrl }, file as any)
                  setFileList((prev) =>
                    prev.map((f) => (f.uid === (file as UploadFile).uid ? { ...f, url, status: 'done' } : f))
                  )
                } catch (err: any) {
                  message.error(err?.response?.data?.detail || 'Ошибка загрузки')
                  onError?.(err)
                }
              }}
              onChange={({ fileList: fl }) => setFileList(fl)}
              onRemove={(file) => {
                setFileList((prev) => prev.filter((f) => f.uid !== file.uid))
              }}
              onDownload={async (file) => {
                const url = file.url || ((file.response as any)?.url ? toDisplayUrl((file.response as any).url) : undefined)
                if (!url) return
                try {
                  const res = await fetch(url)
                  const origBlob = await res.blob()
                  const src = URL.createObjectURL(origBlob)
                  const cropped = await openCropper(src)
                  URL.revokeObjectURL(src)
                  const rawUrl = await uploadBlob(cropped, `cropped-${file.uid}.jpg`)
                  setFileList((prev) =>
                    prev.map((f) =>
                      f.uid === file.uid
                        ? { ...f, url: toDisplayUrl(rawUrl), status: 'done', response: { url: rawUrl } }
                        : f
                    )
                  )
                } catch (err: any) {
                  if (err) message.error(err?.response?.data?.detail || 'Ошибка кадрирования')
                }
              }}
              showUploadList={{
                showPreviewIcon: true,
                showRemoveIcon: true,
                showDownloadIcon: true,
                downloadIcon: <ScissorOutlined title="Кадрировать" />,
              }}
              accept="image/*"
              listType="picture-card"
            >
              <p className="ant-upload-drag-icon">Нажмите или перетащите файлы</p>
            </Upload.Dragger>
            <ImageCropper
              open={cropSrc !== null}
              src={cropSrc}
              onCancel={() => closeCropper()}
              onCrop={(blob) => closeCropper(blob)}
              aspect={1}
            />
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок сортировки" hidden>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="Размеры товара"
        open={sizesOpen}
        onClose={() => setSizesOpen(false)}
        size="large"
        destroyOnClose
      >
        <Form layout="vertical" form={sizeForm} onFinish={(values) => saveSize.mutate(values)}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="name" label="Название" rules={[{ required: true }]} style={{ width: 120 }}>
              <Input placeholder="S / M / L" />
            </Form.Item>
            <Form.Item name="volume" label="Объём" style={{ width: 120 }}>
              <Input placeholder="200 мл" />
            </Form.Item>
            <Form.Item name="base_price" label="Цена" rules={[{ required: true }]} style={{ width: 120 }}>
              <InputNumber style={{ width: '100%' }} min={0} suffix="₽" />
            </Form.Item>
            <Form.Item name="sort_order" label="Сортировка" initialValue={0} style={{ width: 100 }}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space>
            <Button type="primary" htmlType="submit" loading={saveSize.isPending}>
              Сохранить
            </Button>
            <Button onClick={() => sizeForm.resetFields()}>Очистить</Button>
          </Space>
        </Form>

        <Table
          style={{ marginTop: 16 }}
          loading={sizesQuery.isLoading}
          dataSource={sizesQuery.data || []}
          columns={sizeColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Drawer>

      <Drawer
        title="Доступность на точках"
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        destroyOnClose
        extra={
          <Button
            type="primary"
            loading={saveAvailability.isPending}
            onClick={() => {
              if (availabilityProductId) {
                saveAvailability.mutate({
                  product_id: availabilityProductId,
                  store_location_ids: selectedStores,
                })
              }
            }}
          >
            Сохранить
          </Button>
        }
      >
        {availabilityQuery.isLoading ? (
          <Typography.Text>Загрузка...</Typography.Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">Выберите точки, на которых доступен товар:</Typography.Text>
            {(storeLocations || []).map((store: any) => (
              <div
                key={store.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                }}
              >
                <div>
                  <Typography.Text strong>{store.name}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {store.address_text}
                  </Typography.Text>
                </div>
                <Switch
                  checked={selectedStores.includes(store.id)}
                  onChange={(checked) => {
                    if (checked) {
                      setSelectedStores([...selectedStores, store.id])
                    } else {
                      setSelectedStores(selectedStores.filter((id) => id !== store.id))
                    }
                  }}
                />
              </div>
            ))}
          </Space>
        )}
      </Drawer>
    </>
  )
}
