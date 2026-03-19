import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
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

export const ProductsPage = () => {
  const qc = useQueryClient()
  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: fetchProducts })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPercent, setBulkPercent] = useState<number>(0)
  const [bulkDirection, setBulkDirection] = useState<'up' | 'down'>('up')
  const [bulkApplyToAll, setBulkApplyToAll] = useState(false)
  const [bulkApplyToSizes, setBulkApplyToSizes] = useState(false)

  const [sizesOpen, setSizesOpen] = useState(false)
  const [currentProductId, setCurrentProductId] = useState<number | null>(null)
  const sizesQuery = useQuery({
    queryKey: ['product_sizes', currentProductId],
    queryFn: () => fetchSizes(currentProductId || undefined),
    enabled: !!currentProductId,
  })
  const [sizeForm] = Form.useForm()

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

  const bulkUpdatePrices = useMutation({
    mutationFn: async (payload: {
      product_ids?: number[]
      apply_to_all: boolean
      percent: number
      apply_to_sizes: boolean
    }) => api.post('/admin/products/bulk_price', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      if (bulkApplyToSizes && currentProductId) {
        qc.invalidateQueries({ queryKey: ['product_sizes', currentProductId] })
      }
      const updatedProducts = res?.data?.updated_products ?? 0
      const updatedSizes = res?.data?.updated_sizes ?? 0
      message.success(
        bulkApplyToSizes
          ? `Обновлено: товаров — ${updatedProducts}, размеров — ${updatedSizes}`
          : `Обновлено товаров: ${updatedProducts}`,
      )
      setBulkOpen(false)
      setSelectedRowKeys([])
      setBulkPercent(0)
      setBulkDirection('up')
      setBulkApplyToAll(false)
      setBulkApplyToSizes(false)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Не удалось массово изменить цены')
    },
  })

  const columns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id' },
      { title: 'Название', dataIndex: 'name' },
      {
        title: 'Категория',
        dataIndex: 'category_id',
        render: (id: number) => categories?.find((c: any) => c.id === id)?.name || id,
      },
      { title: 'Базовая цена', dataIndex: 'base_price' },
      { title: 'Размеры', render: (_: any, record: any) => (record.size_label ? record.size_label : 'таблица размеров') },
      { title: 'Активен', dataIndex: 'is_active', render: (v: boolean) => (v ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag>) },
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

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={openCreate}>
          Новый товар
        </Button>
        <Button onClick={() => setBulkOpen(true)}>Массовое изменение цен</Button>
        <Button onClick={() => setSelectedRowKeys([])} disabled={selectedRowKeys.length === 0}>
          Снять выделение
        </Button>
        <Typography.Text type="secondary">Выбрано: {selectedRowKeys.length}</Typography.Text>
      </Space>
      <Table
        loading={isLoading}
        dataSource={products || []}
        columns={columns as any}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          preserveSelectedRowKeys: true,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
      />

      <Modal
        open={bulkOpen}
        title="Массовое изменение цен"
        onCancel={() => setBulkOpen(false)}
        okText="Применить"
        confirmLoading={bulkUpdatePrices.isPending}
        onOk={() => {
          if (!bulkApplyToAll && selectedRowKeys.length === 0) {
            message.error('Выберите товары или включите «Применить ко всем товарам»')
            return
          }
          if (!bulkPercent || bulkPercent <= 0) {
            message.error('Введите процент > 0')
            return
          }
          const signedPercent = bulkDirection === 'down' ? -Math.abs(bulkPercent) : Math.abs(bulkPercent)
          Modal.confirm({
            title: 'Подтвердите изменение цен',
            content: bulkApplyToAll
              ? `Применить ${signedPercent}% ко ВСЕМ товарам${bulkApplyToSizes ? ' (включая размеры)' : ''}?`
              : `Применить ${signedPercent}% к выбранным товарам (${selectedRowKeys.length} шт.)${bulkApplyToSizes ? ' (включая размеры)' : ''}?`,
            okText: 'Да, применить',
            cancelText: 'Отмена',
            onOk: () =>
              bulkUpdatePrices.mutate({
                product_ids: bulkApplyToAll ? undefined : selectedRowKeys,
                apply_to_all: bulkApplyToAll,
                percent: signedPercent,
                apply_to_sizes: bulkApplyToSizes,
              }),
          })
        }}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Typography.Text>Применить ко всем товарам</Typography.Text>
            <Switch checked={bulkApplyToAll} onChange={setBulkApplyToAll} />
          </Space>

          {!bulkApplyToAll && (
            <Typography.Text type="secondary">
              Будет применено к выбранным товарам: {selectedRowKeys.length}
            </Typography.Text>
          )}

          <Space wrap>
            <Radio.Group value={bulkDirection} onChange={(e) => setBulkDirection(e.target.value)}>
              <Radio.Button value="up">Повысить</Radio.Button>
              <Radio.Button value="down">Понизить</Radio.Button>
            </Radio.Group>
            <InputNumber
              min={0}
              max={1000}
              value={bulkPercent}
              onChange={(v) => setBulkPercent(typeof v === 'number' ? v : 0)}
            />
            <Typography.Text>%</Typography.Text>
          </Space>

          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Typography.Text>Также изменить цены размеров</Typography.Text>
            <Switch checked={bulkApplyToSizes} onChange={setBulkApplyToSizes} />
          </Space>
        </Space>
      </Modal>

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
    </>
  )
}


