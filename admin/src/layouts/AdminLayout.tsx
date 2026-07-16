import { Layout, Menu, Typography, Button, Space, theme } from 'antd'
import {
  ShopOutlined,
  TagsOutlined,
  SettingOutlined,
  SunOutlined,
  MoonOutlined,
  SlidersFilled,
  StarOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLogout } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'

const { Header, Sider, Content } = Layout

const menuItems = [
  // { key: '/', icon: <AppstoreOutlined />, label: <Link to="/">Главная</Link> },
  { key: '/catalog/categories', icon: <ShopOutlined />, label: <Link to="/catalog/categories">Категории</Link> },
  { key: '/catalog/products', icon: <TagsOutlined />, label: <Link to="/catalog/products">Товары</Link> },
  { key: '/catalog/modifications', icon: <SlidersFilled />, label: <Link to="/catalog/modifications">Модификации</Link> },
  { key: '/catalog/highlights', icon: <StarOutlined />, label: <Link to="/catalog/highlights">Рекомендации</Link> },
  // { key: '/catalog/recommendations', label: <Link to="/catalog/recommendations">Рекомендации по категориям</Link> },
  { key: '/settings/store-locations', icon: <SettingOutlined />, label: <Link to="/settings/store-locations">Адреса магазинов</Link> },
  // {
  //   key: '/marketing',
  //   icon: <GiftOutlined />,
  //   label: 'Маркетинг',
  //   children: [
  //     { key: '/marketing/banners', label: <Link to="/marketing/banners">Баннеры</Link> },
  //     { key: '/marketing/promo-codes', label: <Link to="/marketing/promo-codes">Промокоды</Link> },
  //   ],
  // },
  // {
  //   key: '/delivery',
  //   icon: <DeploymentUnitOutlined />,
  //   label: 'Доставка',
  //   children: [
  //     { key: '/delivery/pickups', label: <Link to="/delivery/pickups">Самовывоз</Link> },
  //     { key: '/delivery/zones', label: <Link to="/delivery/zones">Зоны</Link> },
  //   ],
  // },
  // {
  //   key: '/settings/texts',
  //   label: <Link to="/settings/texts">Тексты</Link>,
  // },
]

export const AdminLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useLogout()
  const { isDark, toggleTheme } = useTheme()
  const { token } = theme.useToken()

  const onLogout = async () => {
    await logout.mutateAsync()
    navigate('/login')
  }

  const selectedKeys = [location.pathname.startsWith('/catalog') ? '/catalog' : location.pathname]

  return (
    <Layout style={{ minHeight: '100vh' }} hasSider>
      <Sider
        theme={isDark ? 'dark' : 'light'}
        style={{
          background: token.colorBgContainer,
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          overflow: 'auto',
          zIndex: 10,
        }}
      >
        <div style={{ padding: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Bageatteria
          </Typography.Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          style={{ background: 'transparent', borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout style={{ marginInlineStart: 200 }}>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Text>Админка</Typography.Text>
          <Space>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
            />
            <Typography.Link onClick={onLogout}>Выйти</Typography.Link>
          </Space>
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

