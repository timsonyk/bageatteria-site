import { Button, Table, Tag, Space, Select, Typography, Modal, Form, Input, InputNumber, Switch, Tabs } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography

interface StockCategory {
  id: number
  name: string
  unit: string
  tolerance: number
  tolerance_is_percent: boolean
  sort_order: number
  is_active: boolean
}

interface StockItem {
  id: number
  name: string
  stock_category_id: number
  product_id: number | null
  iiko_sku: string | null
  unit: string | null
  tolerance: number | null
  sort_order: number
  is_active: boolean
  stock_category: StockCategory | null
}

const fetchCategories = async (): Promise<StockCategory[]> => {
  const res = await api.get('/admin/stock/categories')
  return res.data
}

const fetchItems = async (): Promise<StockItem[]> => {
  const res = await api.get('/admin/stock/items', { params: { active_only: false } })
  return res.data
}

const unitOptions = [
  { value: 'pieces', label: 'Штуки' },
  { value: 'grams', label: 'Граммы' },
  { value: 'kilos', label: 'Килограммы' },
  { value: 'liters', label: 'Литры' },
  { value: 'ml', label: 'Миллилитры' },
]

const getUnitLabel = (unit: string) => {
  const found = unitOptions.find(o => o.value === unit)
  return found ? found.label : unit
}

export const StockItemsPage = () => {
  const qc = useQueryClient()
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null)
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)
  const [categoryForm] = Form.useForm()
  const [itemForm] = Form.useForm()

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['stock-categories'],
    queryFn: fetchCategories,
  })

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['stock-items-all'],
    queryFn: fetchItems,
  })

  // Category mutations
  const saveCategory = useMutation({
    mutationFn: async (values: any) => {
      if (editingCategory) {
        return api.put(`/admin/stock/categories/${editingCategory.id}`, values)
      }
      return api.post('/admin/stock/categories', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-categories'] })
      setCategoryModalOpen(false)
      setEditingCategory(null)
      categoryForm.resetFields()
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/stock/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-categories'] }),
  })

  // Item mutations
  const saveItem = useMutation({
    mutationFn: async (values: any) => {
      if (editingItem) {
        return api.put(`/admin/stock/items/${editingItem.id}`, values)
      }
      return api.post('/admin/stock/items', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items-all'] })
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      setItemModalOpen(false)
      setEditingItem(null)
      itemForm.resetFields()
    },
  })

  const deleteItem = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/stock/items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items-all'] })
      qc.invalidateQueries({ queryKey: ['stock-items'] })
    },
  })

  const categoryColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Название', dataIndex: 'name' },
    {
      title: 'Единица',
      dataIndex: 'unit',
      render: (v: string) => <Tag>{getUnitLabel(v)}</Tag>,
    },
    {
      title: 'Допуск',
      key: 'tolerance',
      render: (_: any, record: StockCategory) => (
        <span>
          ±{record.tolerance}{record.tolerance_is_percent ? '%' : ''}
        </span>
      ),
    },
    {
      title: 'Активна',
      dataIndex: 'is_active',
      render: (v: boolean) => v ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: StockCategory) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCategory(record)
              categoryForm.setFieldsValue(record)
              setCategoryModalOpen(true)
            }}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteCategory.mutate(record.id)}
          />
        </Space>
      ),
    },
  ]

  const itemColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Название', dataIndex: 'name' },
    {
      title: 'Категория',
      key: 'category',
      render: (_: any, record: StockItem) => record.stock_category?.name || '-',
    },
    {
      title: 'Единица',
      key: 'unit',
      render: (_: any, record: StockItem) => {
        const unit = record.unit || record.stock_category?.unit || 'pieces'
        return <Tag>{getUnitLabel(unit)}</Tag>
      },
    },
    {
      title: 'Допуск',
      key: 'tolerance',
      render: (_: any, record: StockItem) => {
        const tolerance = record.tolerance ?? record.stock_category?.tolerance ?? 0
        return `±${tolerance}`
      },
    },
    {
      title: 'iiko SKU',
      dataIndex: 'iiko_sku',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Активен',
      dataIndex: 'is_active',
      render: (v: boolean) => v ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: StockItem) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingItem(record)
              itemForm.setFieldsValue(record)
              setItemModalOpen(true)
            }}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteItem.mutate(record.id)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={3}>Номенклатура для учёта</Title>

      <Tabs
        items={[
          {
            key: 'items',
            label: 'Товары',
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingItem(null)
                      itemForm.resetFields()
                      setItemModalOpen(true)
                    }}
                  >
                    Добавить товар
                  </Button>
                </div>
                <Table
                  loading={itemsLoading}
                  dataSource={items || []}
                  columns={itemColumns}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                />
              </>
            ),
          },
          {
            key: 'categories',
            label: 'Категории',
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingCategory(null)
                      categoryForm.resetFields()
                      setCategoryModalOpen(true)
                    }}
                  >
                    Добавить категорию
                  </Button>
                </div>
                <Table
                  loading={categoriesLoading}
                  dataSource={categories || []}
                  columns={categoryColumns}
                  rowKey="id"
                  pagination={false}
                />
              </>
            ),
          },
        ]}
      />

      {/* Category Modal */}
      <Modal
        title={editingCategory ? 'Редактировать категорию' : 'Новая категория'}
        open={categoryModalOpen}
        onCancel={() => {
          setCategoryModalOpen(false)
          setEditingCategory(null)
        }}
        onOk={() => categoryForm.submit()}
        confirmLoading={saveCategory.isPending}
      >
        <Form
          form={categoryForm}
          layout="vertical"
          initialValues={{ unit: 'pieces', tolerance: 0, tolerance_is_percent: false, is_active: true }}
          onFinish={(values) => saveCategory.mutate(values)}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Кондитерка, Хлебобулочные, Кофе..." />
          </Form.Item>
          <Form.Item name="unit" label="Единица измерения" rules={[{ required: true }]}>
            <Select options={unitOptions} />
          </Form.Item>
          <Form.Item name="tolerance" label="Допустимое расхождение">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tolerance_is_percent" label="Допуск в процентах" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sort_order" label="Сортировка">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Активна" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Item Modal */}
      <Modal
        title={editingItem ? 'Редактировать товар' : 'Новый товар'}
        open={itemModalOpen}
        onCancel={() => {
          setItemModalOpen(false)
          setEditingItem(null)
        }}
        onOk={() => itemForm.submit()}
        confirmLoading={saveItem.isPending}
      >
        <Form
          form={itemForm}
          layout="vertical"
          initialValues={{ is_active: true }}
          onFinish={(values) => saveItem.mutate(values)}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Круассан шоколадный, Кофе зерновой..." />
          </Form.Item>
          <Form.Item name="stock_category_id" label="Категория" rules={[{ required: true }]}>
            <Select
              options={categories?.map(c => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="unit" label="Единица (переопределить)">
            <Select allowClear options={unitOptions} placeholder="Использовать из категории" />
          </Form.Item>
          <Form.Item name="tolerance" label="Допуск (переопределить)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Использовать из категории" />
          </Form.Item>
          <Form.Item name="iiko_sku" label="iiko SKU">
            <Input placeholder="Артикул в iiko" />
          </Form.Item>
          <Form.Item name="sort_order" label="Сортировка">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
