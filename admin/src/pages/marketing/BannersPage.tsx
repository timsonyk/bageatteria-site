import { Button, Form, Input, Modal, Space, Switch, Table, Upload, message } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'

const fetchBanners = async () => (await api.get('/admin/banners')).data

export const BannersPage = () => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['banners'], queryFn: fetchBanners })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const save = useMutation({
    mutationFn: async (values: any) => {
      if (editing) return api.put(`/admin/banners/${editing.id}`, values)
      return api.post('/admin/banners', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] })
      setOpen(false)
      setEditing(null)
      form.resetFields()
      setFileList([])
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/banners/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banners'] }),
  })

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'Заголовок', dataIndex: 'title' },
    { title: 'Подзаголовок', dataIndex: 'subtitle' },
    { title: 'Изображение', dataIndex: 'image_url' },
    { title: 'Сортировка', dataIndex: 'sort_order' },
    { title: 'Активен', dataIndex: 'is_active', render: (v: boolean) => (v ? 'Да' : 'Нет') },
    {
      title: 'Действия',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditing(record)
              form.setFieldsValue(record)
              if (record.image_url) {
                setFileList([
                  {
                    uid: '1',
                    name: record.image_url.split('/').pop() || 'изображение',
                    status: 'done',
                    url: record.image_url,
                  },
                ])
              } else {
                setFileList([])
              }
              setOpen(true)
            }}
          >
            Редактировать
          </Button>
          <Button danger size="small" onClick={() => remove.mutate(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          Новый баннер
        </Button>
      </Space>
      <Table loading={isLoading} dataSource={data || []} columns={columns} rowKey="id" />

      <Modal
        open={open}
        title={editing ? 'Редактировать баннер' : 'Новый баннер'}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
          setFileList([])
        }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ is_active: true, sort_order: 0 }}
          onFinish={(values) => {
            const imageUrl = fileList.find((f) => f.status === 'done')?.url
            save.mutate({ ...values, image_url: imageUrl })
          }}
        >
          <Form.Item name="title" label="Заголовок" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="subtitle" label="Подзаголовок">
            <Input />
          </Form.Item>
          <Form.Item label="Изображение">
            <Upload.Dragger
              name="file"
              multiple={false}
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
                  setFileList([{ uid: (file as UploadFile).uid, name: (file as any).name, status: 'done', url }])
                } catch (err: any) {
                  message.error(err?.response?.data?.detail || 'Ошибка загрузки')
                  onError?.(err)
                }
              }}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
              onRemove={() => {
                setFileList([])
              }}
              accept="image/*"
              listType="picture-card"
            >
              <p className="ant-upload-drag-icon">Нажмите или перетащите файл</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок сортировки">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}


