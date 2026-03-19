import { Button, Form, InputNumber, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

const fetchLoyalty = async () => (await api.get('/admin/loyalty_settings')).data

export const LoyaltyPage = () => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['loyalty_settings'], queryFn: fetchLoyalty })
  const [form] = Form.useForm()

  const save = useMutation({
    mutationFn: async (values: any) => api.put('/admin/loyalty_settings', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty_settings'] })
      message.success('Сохранено')
    },
  })

  return (
    <Form
      layout="vertical"
      form={form}
      initialValues={{ cashback_percent: data?.cashback_percent }}
      onFinish={(values) => save.mutate(values)}
    >
      <Form.Item
        label="Процент кэшбэка"
        name="cashback_percent"
        rules={[{ required: true, message: 'Обязательно' }]}
      >
        <InputNumber min={0} max={50} style={{ width: 200 }} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={save.isPending} disabled={isLoading}>
        Сохранить
      </Button>
    </Form>
  )
}


