import { Button, Form, Input, Space, Table } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

const fetchTexts = async () => (await api.get('/admin/app_texts')).data

export const TextsPage = () => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['app_texts'], queryFn: fetchTexts })
  const [form] = Form.useForm()

  const save = useMutation({
    mutationFn: async (values: any) => api.put('/admin/app_texts', values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_texts'] }),
  })

  const columns = [
    { title: 'Ключ', dataIndex: 'key' },
    { title: 'Значение', dataIndex: 'value' },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Form layout="inline" form={form} onFinish={(values) => save.mutate(values)}>
        <Form.Item name="key" rules={[{ required: true }]} label="Ключ">
          <Input placeholder="about_app" />
        </Form.Item>
        <Form.Item name="value" rules={[{ required: true }]} label="Значение">
          <Input style={{ width: 400 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={save.isPending}>
            Сохранить
          </Button>
        </Form.Item>
      </Form>

      <Table loading={isLoading} dataSource={data || []} columns={columns} rowKey="key" />
    </Space>
  )
}


