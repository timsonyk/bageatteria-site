import { Card, Col, Row, Statistic } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

const fetchSummary = async () => {
  const orders = await api.get('/admin/orders?limit=100')
  const today = new Date().toDateString()
  const todaysOrders = orders.data.filter((o: any) => new Date(o.created_at).toDateString() === today)
  const revenue = todaysOrders.reduce((acc: number, o: any) => acc + parseFloat(o.total), 0)
  const avg = todaysOrders.length ? revenue / todaysOrders.length : 0
  return { count: todaysOrders.length, revenue, avg }
}

export const DashboardPage = () => {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: fetchSummary })

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card>
          <Statistic title="Заказы сегодня" value={data?.count ?? 0} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="Выручка сегодня" value={data?.revenue ?? 0} precision={2} suffix="₽" />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="Средний чек" value={data?.avg ?? 0} precision={2} suffix="₽" />
        </Card>
      </Col>
    </Row>
  )
}


