import { useEffect, useMemo, useState } from 'react'
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
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

const fetchProducts = async () => (await api.get('/admin/products')).data
const fetchCategories = async () => (await api.get('/admin/categories')).data
const fetchSizes = async (productId?: number) =>
  (await api.get('/admin/product_sizes', { params: productId ? { product_id: productId } : {} })).data
const fetchStoreLocations = async () => (await api.get('/admin/store_locations')).data
const fetchProductAvailability = async (productId: number) =>
  (await api.get('/admin/product_availability', { params: { product_id: productId } })).data

export const ProductsPage = () => {
  const qc = useQueryClient()
  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: fetchProducts })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])


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


  const columns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 60 },
      {
        title: 'Фото',
        dataIndex: 'media',
        width: 60,
        render: (media: string[]) => {
          const url = media?.[0]
          if (!url) return <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: 4 }} />
          const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}${url}`
          return (
            <img
              src={fullUrl}
              alt=""
              style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
            />
          )
        },
      },
      { title: 'Название', dataIndex: 'name' },
      {
        title: 'Категория',
        dataIndex: 'category_id',
        render: (id: number) => categories?.find((c: any) => c.id === id)?.name || id,
      },
      { title: 'Базовая цена', dataIndex: 'base_price' },
      { title: 'Размеры', render: (_: any, record: any) => (record.size_label ? record.size_label : 'таблица размеров') },
      {
        title: 'Активен',
        dataIndex: 'is_active',
        width: 80,
        render: (v: boolean, record: any) => (
          <Switch
            checked={v}
            size="small"
            onChange={(checked) => {
              api.put(`/admin/products/${record.id}`, { ...record, is_active: checked }).then(() => {
                qc.invalidateQueries({ queryKey: ['products'] })
              })
            }}
          />
        ),
      },
      {
        title: 'Действия',
        render: (_: any, record: any) => (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setEditing(record)
                form.resetFields()
                form.setFieldsValue(record)
                if (record.media && Array.isArray(record.media)) {
                  setFileList(
                    record.media.map((url: string, idx: number) => ({
                      uid: `${idx}`,
                      name: url.split('/').pop() || `изображение-${idx}`,
                      status: 'done',
                      url,
                    })),
                  )
                } else {
                  setFileList([])
                }
                setOpen(true)
              }}
            >
              Редактировать
            </Button>
            <Button
              size="small"
              onClick={() => {
                setCurrentProductId(record.id)
                setSizesOpen(true)
              }}
            >
              Размеры
            </Button>
            <Button
              size="small"
              onClick={() => {
                setAvailabilityProductId(record.id)
                setAvailabilityOpen(true)
              }}
            >
              Точки
            </Button>
            <Button danger size="small" onClick={() => deleteProduct.mutate(record.id)}>
              Удалить
            </Button>
          </Space>
        ),
      },
    ],
    [categories, form, deleteProduct],
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
          <Button
            size="small"
            onClick={() => {
              sizeForm.setFieldsValue(record)
            }}
          >
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

  // Load selected stores when opening availability drawer
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

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={openCreate}>
          Новый товар
        </Button>
      </Space>
      <Table
        loading={isLoading}
        dataSource={products || []}
        columns={columns as any}
        rowKey="id"
      />

      <Modal
        open={open}
        title={editing ? 'Редактировать товар' : 'Новый товар'}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveProduct.isPending}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ is_active: true, sort_order: 0 }}
          onFinish={(values) => {
            const mediaUrls = fileList
              .map((f) => (f.response as any)?.url || f.url)
              .filter(Boolean)
            saveProduct.mutate({ ...values, media: mediaUrls })
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
            <Form.Item name="weight" label="Вес / Объём" style={{ flex: 1 }}>
              <Input placeholder="400 г или 300 мл" />
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
              customRequest={async (options) => {
                const { file, onError, onSuccess } = options
                const formData = new FormData()
                formData.append('file', file as Blob)
                try {
                  const res = await api.post('/admin/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  })
                  const url = res.data.url
                  onSuccess?.(res.data, file as any)
                  setFileList((prev) =>
                    prev.map((f) => (f.uid === (file as UploadFile).uid ? { ...f, url, status: 'done' } : f)),
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
              accept="image/*"
              listType="picture-card"
            >
              <p className="ant-upload-drag-icon">Нажмите или перетащите файлы</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок сортировки" initialValue={0}>
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
        destroyOnHidden
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
              <InputNumber style={{ width: '100%' }} min={0} addonAfter="₽" />
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
        />
      </Drawer>

      <Drawer
        title="Доступность на точках"
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        destroyOnHidden
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
            <Typography.Text type="secondary">
              Выберите точки, на которых доступен товар:
            </Typography.Text>
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


