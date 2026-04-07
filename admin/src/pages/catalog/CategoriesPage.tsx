import { useEffect, useState, useCallback } from 'react'
import { Button, Drawer, Form, Input, Modal, Space, Switch, Typography, Select, message, Card, Spin } from 'antd'
import { HolderOutlined, EditOutlined, DeleteOutlined, ShopOutlined } from '@ant-design/icons'
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

const fetchCategories = async () => {
  const res = await api.get('/admin/categories')
  return res.data
}

const fetchStoreLocations = async () => (await api.get('/admin/store_locations')).data
const fetchCategoryAvailability = async (categoryId: number) =>
  (await api.get('/admin/category_availability', { params: { category_id: categoryId } })).data

interface Category {
  id: number
  name: string
  unit?: string
  sort_order: number
  is_active: boolean
}

const UNIT_OPTIONS = [
  { value: '', label: 'Не указано' },
  { value: 'г', label: 'г (граммы)' },
  { value: 'кг', label: 'кг (килограммы)' },
  { value: 'мл', label: 'мл (миллилитры)' },
]

// Sortable category row
function SortableCategoryRow({
  category,
  onEdit,
  onAvailability,
  onDelete,
  onToggleActive,
}: {
  category: Category
  onEdit: (c: Category) => void
  onAvailability: (c: Category) => void
  onDelete: (id: number) => void
  onToggleActive: (c: Category, active: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
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

      <div style={{ flex: 1, minWidth: 0 }}>
        <Typography.Text strong style={{ display: 'block' }}>
          {category.name}
        </Typography.Text>
        {category.unit && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Единица: {category.unit}
          </Typography.Text>
        )}
      </div>

      <Switch
        checked={category.is_active}
        size="small"
        onChange={(checked) => onToggleActive(category, checked)}
      />

      <Space size={4}>
        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(category)} />
        <Button type="text" size="small" icon={<ShopOutlined />} onClick={() => onAvailability(category)} />
        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(category.id)} />
      </Space>
    </div>
  )
}

export const CategoriesPage = () => {
  const qc = useQueryClient()
  const { data: categories, isLoading } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form] = Form.useForm()

  // Local state for optimistic reordering
  const [localCategories, setLocalCategories] = useState<Category[]>([])

  // Sync local categories with server data
  useEffect(() => {
    if (categories) {
      setLocalCategories([...categories].sort((a: Category, b: Category) => a.sort_order - b.sort_order))
    }
  }, [categories])

  // Store availability
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [availabilityCategoryId, setAvailabilityCategoryId] = useState<number | null>(null)
  const { data: storeLocations } = useQuery({ queryKey: ['store_locations'], queryFn: fetchStoreLocations })
  const availabilityQuery = useQuery({
    queryKey: ['category_availability', availabilityCategoryId],
    queryFn: () => fetchCategoryAvailability(availabilityCategoryId!),
    enabled: !!availabilityCategoryId,
  })
  const [selectedStores, setSelectedStores] = useState<number[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const save = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        return api.put(`/admin/categories/${editing.id}`, values)
      }
      return api.post('/admin/categories', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
  })

  const saveSortOrder = useMutation({
    mutationFn: async (items: { id: number; sort_order: number }[]) => {
      return api.post('/admin/categories/bulk_sort', { items })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: () => {
      message.error('Не удалось сохранить порядок')
      if (categories) setLocalCategories([...categories].sort((a: Category, b: Category) => a.sort_order - b.sort_order))
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const saveAvailability = useMutation({
    mutationFn: async (payload: { category_id: number; store_location_ids: number[] }) =>
      api.post('/admin/category_availability/bulk', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category_availability', availabilityCategoryId] })
      message.success('Доступность сохранена')
      setAvailabilityOpen(false)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Не удалось сохранить доступность')
    },
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = localCategories.findIndex((c) => c.id === active.id)
      const newIndex = localCategories.findIndex((c) => c.id === over.id)
      const newOrder = arrayMove(localCategories, oldIndex, newIndex)

      // Optimistic update
      setLocalCategories(newOrder.map((c, idx) => ({ ...c, sort_order: idx })))

      // Save to server
      const items = newOrder.map((c, idx) => ({ id: c.id, sort_order: idx }))
      saveSortOrder.mutate(items)
    }
  }

  const handleEdit = useCallback((category: Category) => {
    setEditing(category)
    form.setFieldsValue(category)
    setOpen(true)
  }, [form])

  const handleAvailability = useCallback((category: Category) => {
    setAvailabilityCategoryId(category.id)
    setAvailabilityOpen(true)
  }, [])

  const handleDelete = useCallback((id: number) => {
    remove.mutate(id)
  }, [remove])

  const handleToggleActive = useCallback((category: Category, active: boolean) => {
    api.put(`/admin/categories/${category.id}`, { ...category, is_active: active }).then(() => {
      qc.invalidateQueries({ queryKey: ['categories'] })
    })
  }, [qc])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ is_active: true, sort_order: 0 })
    setOpen(true)
  }

  // Load selected stores when opening availability drawer
  useEffect(() => {
    if (availabilityOpen && availabilityQuery.data) {
      setSelectedStores(availabilityQuery.data.map((a: any) => a.store_location_id))
    }
  }, [availabilityOpen, availabilityQuery.data])

  useEffect(() => {
    if (!availabilityOpen) {
      setAvailabilityCategoryId(null)
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
          Новая категория
        </Button>
      </Space>

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Перетаскивайте категории для изменения порядка
      </Typography.Text>

      <Card styles={{ body: { padding: 0 } }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {localCategories.map((category) => (
              <SortableCategoryRow
                key={category.id}
                category={category}
                onEdit={handleEdit}
                onAvailability={handleAvailability}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
              />
            ))}
          </SortableContext>
        </DndContext>
        {localCategories.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Нет категорий</div>
        )}
      </Card>

      <Modal
        open={open}
        title={editing ? 'Редактировать категорию' : 'Новая категория'}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ is_active: true }}
          onFinish={(values) => save.mutate(values)}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="Единица измерения (для веса/объёма товаров)">
            <Select options={UNIT_OPTIONS} allowClear placeholder="Выберите единицу" />
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок сортировки" hidden>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="is_active" label="Активна" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

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
              if (availabilityCategoryId) {
                saveAvailability.mutate({
                  category_id: availabilityCategoryId,
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
              Выберите точки, на которых доступна категория:
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
