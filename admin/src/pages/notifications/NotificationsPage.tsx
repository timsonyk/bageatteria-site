import { Button, Card, Form, Input, Modal, Select, Space, Statistic, Table, message } from 'antd'
import { SendOutlined, BellOutlined, MobileOutlined, HistoryOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'

const { TextArea } = Input

const fetchStats = async () => (await api.get('/admin/push-stats')).data
const fetchCampaigns = async () => (await api.get('/admin/push-campaigns')).data

interface PushCampaign {
  id: number
  title: string
  body: string
  notification_type: string
  sent_count: number
  failed_count: number
  created_at: string
}

export const NotificationsPage = () => {
  const qc = useQueryClient()
  const { data: stats } = useQuery({ queryKey: ['push-stats'], queryFn: fetchStats })
  const { data: campaigns, isLoading } = useQuery({ queryKey: ['push-campaigns'], queryFn: fetchCampaigns })
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const sendPush = useMutation({
    mutationFn: async (values: any) => {
      return api.post('/admin/push-campaigns/send', values)
    },
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['push-stats'] })
      qc.invalidateQueries({ queryKey: ['push-campaigns'] })
      setOpen(false)
      form.resetFields()
      message.success(`Уведомление отправлено ${response.data.sent_count} устройствам`)
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Ошибка отправки')
    },
  })

  const notificationTypes = [
    { value: 'promo', label: 'Промо/Акция' },
    { value: 'order', label: 'Заказ' },
    { value: 'system', label: 'Системное' },
    { value: 'bonus', label: 'Бонусы' },
  ]

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Заголовок', dataIndex: 'title' },
    { title: 'Текст', dataIndex: 'body', ellipsis: true },
    {
      title: 'Тип',
      dataIndex: 'notification_type',
      render: (type: string) => {
        const found = notificationTypes.find((t) => t.value === type)
        return found?.label || type
      },
    },
    {
      title: 'Отправлено',
      dataIndex: 'sent_count',
      render: (count: number, record: PushCampaign) => (
        <span>
          {count} <span style={{ color: record.failed_count > 0 ? 'red' : 'inherit' }}>
            {record.failed_count > 0 && `(${record.failed_count} ошибок)`}
          </span>
        </span>
      ),
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      render: (date: string) => {
        const d = new Date(date)
        return d.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      },
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: 24 }}>
        <BellOutlined /> Push-уведомления
      </h1>

      {/* Stats Cards */}
      <Space size="large" style={{ marginBottom: 24 }}>
        <Card>
          <Statistic
            title="Активных устройств"
            value={stats?.active_devices || 0}
            prefix={<MobileOutlined />}
          />
        </Card>
        <Card>
          <Statistic
            title="Всего рассылок"
            value={stats?.total_campaigns || 0}
            prefix={<HistoryOutlined />}
          />
        </Card>
        <Card>
          <Statistic
            title="Всего уведомлений"
            value={stats?.total_notifications || 0}
            prefix={<BellOutlined />}
          />
        </Card>
      </Space>

      {/* Send Button */}
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => setOpen(true)}
          size="large"
        >
          Отправить уведомление
        </Button>
      </Space>

      {/* Campaigns History */}
      <Card title="История рассылок">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={campaigns || []}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Send Modal */}
      <Modal
        title="Отправить push-уведомление"
        open={open}
        onCancel={() => {
          setOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={sendPush.isPending}
        okText="Отправить"
        cancelText="Отмена"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => sendPush.mutate(values)}
          initialValues={{ notification_type: 'promo' }}
        >
          <Form.Item
            name="title"
            label="Заголовок"
            rules={[{ required: true, message: 'Введите заголовок' }]}
          >
            <Input placeholder="Заголовок уведомления" maxLength={100} showCount />
          </Form.Item>

          <Form.Item
            name="body"
            label="Текст уведомления"
            rules={[{ required: true, message: 'Введите текст' }]}
          >
            <TextArea
              placeholder="Текст push-уведомления"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="notification_type"
            label="Тип уведомления"
            rules={[{ required: true }]}
          >
            <Select options={notificationTypes} />
          </Form.Item>

          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginTop: 16 }}>
            <strong>Внимание:</strong> Уведомление будет отправлено всем пользователям с
            активными устройствами ({stats?.active_devices || 0} устройств).
          </div>
        </Form>
      </Modal>
    </div>
  )
}
