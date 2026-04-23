import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Upload, Image, message } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'

const fetchGroups = async (product_id?: number) =>
  (await api.get('/admin/modification_groups', { params: product_id ? { product_id } : {} })).data
const fetchOptions = async (group_id?: number) =>
  (await api.get('/admin/modification_options', { params: group_id ? { group_id } : {} })).data
const fetchProducts = async () => (await api.get('/admin/products')).data

export const ModificationsPage = () => {
  const qc = useQueryClient()
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts })
  const [productFilter, setProductFilter] = useState<number | undefined>(undefined)
  const { data: groups, isLoading } = useQuery({
    queryKey: ['mod_groups', productFilter],
    queryFn: () => fetchGroups(productFilter),
  })
  const [openGroup, setOpenGroup] = useState(false)
  const [editingGroup, setEditingGroup] = useState<any>(null)
  const [groupForm] = Form.useForm()

  const [openOption, setOpenOption] = useState(false)
  const [editingOption, setEditingOption] = useState<any>(null)
  const [showOptionForm, setShowOptionForm] = useState(false)
  const [optionForm] = Form.useForm()
  const [currentGroupId, setCurrentGroupId] = useState<number | null>(null)
  const [currentGroupName, setCurrentGroupName] = useState<string>('')
  const [optionFileList, setOptionFileList] = useState<UploadFile[]>([])
  const optionsQuery = useQuery({
    queryKey: ['mod_options', currentGroupId],
    queryFn: () => fetchOptions(currentGroupId || undefined),
    enabled: !!currentGroupId,
  })

  const saveGroup = useMutation({
    mutationFn: async (values: any) => {
      if (editingGroup) return api.put(`/admin/modification_groups/${editingGroup.id}`, values)
      return api.post('/admin/modification_groups', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mod_groups'] })
      setOpenGroup(false)
      setEditingGroup(null)
      groupForm.resetFields()
    },
  })

  const saveOption = useMutation({
    mutationFn: async (values: any) => {
      if (editingOption) {
        const { id, ...rest } = values
        return api.put(`/admin/modification_options/${id}`, rest)
      }
      return api.post('/admin/modification_options', { ...values, group_id: currentGroupId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mod_options', currentGroupId] })
      // Don't close modal, just reset form
      setEditingOption(null)
      setShowOptionForm(false)
      optionForm.resetFields()
      setOptionFileList([])
      message.success(editingOption ? 'Опция обновлена' : 'Опция добавлена')
    },
  })

  const deleteGroup = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/modification_groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod_groups'] }),
  })

  const deleteOption = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/modification_options/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod_options', currentGroupId] }),
  })

  const groupColumns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Тип', dataIndex: 'type' },
    { title: 'Мин.', dataIndex: 'min_count' },
    { title: 'Макс.', dataIndex: 'max_count' },
    {
      title: 'Товары',
      dataIndex: 'products',
      render: (list: any[]) => (list || []).map((p) => p.name || p.id).join(', '),
    },
    { title: 'Активна', dataIndex: 'is_active', render: (v: boolean) => (v ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag>) },
    {
      title: 'Действия',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditingGroup(record)
              groupForm.setFieldsValue({
                ...record,
                product_ids: (record.products || []).map((p: any) => p.id),
              })
              setOpenGroup(true)
            }}
          >
            Редактировать
          </Button>
          <Button
            size="small"
            onClick={() => {
              setCurrentGroupId(record.id)
              setCurrentGroupName(record.name)
              setShowOptionForm(false)
              setEditingOption(null)
              optionForm.resetFields()
              setOptionFileList([])
              setOpenOption(true)
            }}
          >
            Опции
          </Button>
          <Button danger size="small" onClick={() => deleteGroup.mutate(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  const optionColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { 
      title: 'Фото', 
      dataIndex: 'image_url', 
      width: 80,
      render: (url: string) => url ? <Image src={url} width={50} height={50} style={{ objectFit: 'cover', borderRadius: 4 }} /> : '-' 
    },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Доплата', dataIndex: 'extra_price', render: (v: number) => `${v} ₽` },
    { title: 'По умолчанию', dataIndex: 'is_default', render: (v: boolean) => (v ? 'Да' : 'Нет') },
    {
      title: 'Действия',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditingOption(record)
              optionForm.setFieldsValue(record)
              if (record.image_url) {
                setOptionFileList([{
                  uid: '-1',
                  name: record.image_url.split('/').pop() || 'изображение',
                  status: 'done',
                  url: record.image_url,
                }])
              } else {
                setOptionFileList([])
              }
              setShowOptionForm(true)
            }}
          >
            Редактировать
          </Button>
          <Button danger size="small" onClick={() => deleteOption.mutate(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Select
          placeholder="Фильтр по товару"
          allowClear
          style={{ width: 240 }}
          value={productFilter}
          onChange={(v) => setProductFilter(v)}
          options={(products || []).map((p: any) => ({ value: p.id, label: p.name }))}
        />
        <Button type="primary" onClick={() => setOpenGroup(true)}>
          Новая группа
        </Button>
      </Space>
      <Table loading={isLoading} dataSource={groups || []} columns={groupColumns} rowKey="id" />

      <Modal
        open={openGroup}
        title={editingGroup ? 'Редактировать группу' : 'Новая группа'}
        onCancel={() => {
          setOpenGroup(false)
          setEditingGroup(null)
        }}
        onOk={() => groupForm.submit()}
        confirmLoading={saveGroup.isPending}
      >
        <Form
          layout="vertical"
          form={groupForm}
          initialValues={{ type: 'single', min_count: 0, max_count: 1, is_active: true }}
          onFinish={(values) => saveGroup.mutate({ ...values, type: (values.type || 'single') })}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="product_ids" label="Товары">
            <Select
              mode="multiple"
              allowClear
              options={(products || []).map((p: any) => ({ value: p.id, label: p.name }))}
              placeholder="Выберите товары"
            />
          </Form.Item>
          <Form.Item name="type" label="Тип">
            <Select
              options={[
                { value: 'single', label: 'Один (радио)' },
                { value: 'multiple', label: 'Несколько (чекбоксы)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="min_count" label="Мин. количество">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="max_count" label="Макс. количество">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок сортировки">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="is_active" label="Активна" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={openOption}
        title={`Опции: ${currentGroupName}`}
        width={700}
        onCancel={() => {
          setOpenOption(false)
          setEditingOption(null)
          setShowOptionForm(false)
          setOptionFileList([])
        }}
        footer={
          <Button onClick={() => setOpenOption(false)}>Закрыть</Button>
        }
      >
        {!showOptionForm ? (
          <Button
            type="primary"
            style={{ marginBottom: 16 }}
            onClick={() => {
              setEditingOption(null)
              optionForm.resetFields()
              setOptionFileList([])
              setShowOptionForm(true)
            }}
          >
            Добавить опцию
          </Button>
        ) : (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 8, border: '1px solid var(--ant-color-border)' }}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>
              {editingOption ? 'Редактировать опцию' : 'Новая опция'}
            </div>
            <Form
              layout="vertical"
              form={optionForm}
              initialValues={{ is_active: true, sort_order: 0, is_default: false, extra_price: 0 }}
              onFinish={(values) => {
                const imageUrl = optionFileList.length > 0
                  ? (optionFileList[0].response as any)?.url || optionFileList[0].url
                  : null
                saveOption.mutate({ ...values, image_url: imageUrl })
              }}
            >
              <Form.Item name="id" hidden>
                <Input />
              </Form.Item>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="name" label="Название" rules={[{ required: true }]} style={{ marginBottom: 8, width: 200 }}>
                  <Input />
                </Form.Item>
                <Form.Item name="extra_price" label="Доплата" rules={[{ required: true }]} style={{ marginBottom: 8, width: 120 }}>
                  <InputNumber style={{ width: '100%' }} addonAfter="₽" />
                </Form.Item>
                <Form.Item name="sort_order" label="Сортировка" style={{ marginBottom: 8, width: 100 }}>
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
              </Space>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="is_default" label="По умолчанию" valuePropName="checked" style={{ marginBottom: 8 }}>
                  <Switch />
                </Form.Item>
                <Form.Item name="is_active" label="Активна" valuePropName="checked" style={{ marginBottom: 8 }}>
                  <Switch />
                </Form.Item>
              </Space>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666', background: '#FAFAFA', padding: '8px 10px', borderRadius: 4 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Как это работает</div>
                <div style={{ marginBottom: 2 }}>
                  • <b>Проценты</b> — замена части состава:{' '}
                  <code>итог = база × (1 + pct/100)</code>.
                  Пример: Латте 202 ккал с банановым молоком (−30%) → 202×0.7 = 141 ккал.
                </div>
                <div style={{ marginBottom: 2 }}>
                  • <b>Абсолют</b> — добавление фиксированного количества:{' '}
                  <code>итог = база + значение</code>.
                  Пример: +1 яйцо = +55 ккал, независимо от размера блюда.
                </div>
                <div>
                  Заполните <b>ОДИН</b> столбец на строку (для каждого поля
                  отдельно). Если оба заданы — применяется процент.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 120px 120px', gap: '8px 16px', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#888', gridColumn: 2 }}>Абсолют</div>
                <div style={{ fontSize: 12, color: '#888' }}>Проценты</div>

                <div>Ккал</div>
                <Form.Item name="calories" style={{ margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} step={1} placeholder="+55" />
                </Form.Item>
                <Form.Item name="calories_pct" style={{ margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} step={1} suffix="%" placeholder="-50" />
                </Form.Item>

                <div>Белки, г</div>
                <Form.Item name="proteins" style={{ margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} step={0.1} />
                </Form.Item>
                <Form.Item name="proteins_pct" style={{ margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} step={1} suffix="%" />
                </Form.Item>

                <div>Жиры, г</div>
                <Form.Item name="fats" style={{ margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} step={0.1} />
                </Form.Item>
                <Form.Item name="fats_pct" style={{ margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} step={1} suffix="%" />
                </Form.Item>

                <div>Углеводы, г</div>
                <Form.Item name="carbs" style={{ margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} step={0.1} />
                </Form.Item>
                <Form.Item name="carbs_pct" style={{ margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} step={1} suffix="%" />
                </Form.Item>
              </div>
              <Form.Item label="Изображение" style={{ marginBottom: 8 }}>
                <Upload
                  name="file"
                  maxCount={1}
                  fileList={optionFileList}
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
                      setOptionFileList([{
                        uid: (file as UploadFile).uid,
                        name: (file as UploadFile).name,
                        url,
                        status: 'done',
                        response: res.data,
                      }])
                    } catch (err: any) {
                      message.error(err?.response?.data?.detail || 'Ошибка загрузки')
                      onError?.(err)
                    }
                  }}
                  onChange={({ fileList: fl }) => setOptionFileList(fl)}
                  onRemove={() => {
                    setOptionFileList([])
                  }}
                  accept="image/*"
                  listType="picture-card"
                >
                  {optionFileList.length === 0 && '+ Фото'}
                </Upload>
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={saveOption.isPending}>
                  {editingOption ? 'Сохранить' : 'Добавить'}
                </Button>
                <Button onClick={() => {
                  setShowOptionForm(false)
                  setEditingOption(null)
                  optionForm.resetFields()
                  setOptionFileList([])
                }}>
                  Отмена
                </Button>
              </Space>
            </Form>
          </div>
        )}

        <Table
          loading={optionsQuery.isLoading}
          dataSource={optionsQuery.data || []}
          columns={optionColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Modal>
    </>
  )
}


