import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Select, Space, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

interface Product {
  id: number
  name: string
  category_id: number
  base_price: number
  is_active: boolean
  is_recommended_menu: boolean
  is_recommended_favorites: boolean
  is_featured_menu: boolean
  featured_text?: string | null
}

interface Category {
  id: number
  name: string
}

const fetchProducts = async (): Promise<Product[]> =>
  (await api.get('/admin/products')).data

const fetchCategories = async (): Promise<Category[]> =>
  (await api.get('/admin/categories')).data

type FlagKey = 'is_recommended_menu' | 'is_recommended_favorites' | 'is_featured_menu'

export const HighlightsPage = () => {
  const qc = useQueryClient()

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const [menuRec, setMenuRec] = useState<number[]>([])
  const [favRec, setFavRec] = useState<number[]>([])
  const [featuredIds, setFeaturedIds] = useState<number[]>([])
  const [featuredTexts, setFeaturedTexts] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!products) return
    setMenuRec(products.filter((p) => p.is_recommended_menu).map((p) => p.id))
    setFavRec(products.filter((p) => p.is_recommended_favorites).map((p) => p.id))
    const featured = products.filter((p) => p.is_featured_menu)
    setFeaturedIds(featured.map((p) => p.id))
    const texts: Record<number, string> = {}
    for (const p of featured) texts[p.id] = p.featured_text ?? ''
    setFeaturedTexts(texts)
  }, [products])

  // Если человек добавил товар в "Наши новинки", подтянуть его текущий featured_text
  useEffect(() => {
    if (!products) return
    setFeaturedTexts((prev) => {
      const next = { ...prev }
      for (const id of featuredIds) {
        if (next[id] === undefined) {
          const p = products.find((x) => x.id === id)
          next[id] = p?.featured_text ?? ''
        }
      }
      return next
    })
  }, [featuredIds, products])

  const productOptions = useMemo(() => {
    if (!products || !categories) return []
    const catMap = new Map(categories.map((c) => [c.id, c.name]))
    return products
      .filter((p) => p.is_active)
      .map((p) => ({
        value: p.id,
        label: `${p.name} (${catMap.get(p.category_id) ?? '—'}) — ${p.base_price} ₽`,
      }))
  }, [products, categories])

  const syncFlag = async (flag: FlagKey, desired: number[]) => {
    if (!products) return
    const desiredSet = new Set(desired)
    const updates: Promise<unknown>[] = []
    for (const p of products) {
      const current = Boolean(p[flag])
      const want = desiredSet.has(p.id)
      if (current !== want) {
        updates.push(api.put(`/admin/products/${p.id}`, { [flag]: want }))
      }
    }
    await Promise.all(updates)
  }

  const saveMenuRec = useMutation({
    mutationFn: () => syncFlag('is_recommended_menu', menuRec),
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const saveFavRec = useMutation({
    mutationFn: () => syncFlag('is_recommended_favorites', favRec),
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const saveFeatured = useMutation({
    mutationFn: async () => {
      await syncFlag('is_featured_menu', featuredIds)
      // Сохраняем featured_text для каждого выбранного товара
      const updates: Promise<unknown>[] = []
      for (const id of featuredIds) {
        const text = (featuredTexts[id] ?? '').trim()
        updates.push(
          api.put(`/admin/products/${id}`, { featured_text: text || null })
        )
      }
      await Promise.all(updates)
    },
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const initialMenuRec = useMemo(
    () => (products ?? []).filter((p) => p.is_recommended_menu).map((p) => p.id),
    [products]
  )
  const initialFavRec = useMemo(
    () => (products ?? []).filter((p) => p.is_recommended_favorites).map((p) => p.id),
    [products]
  )
  const initialFeaturedIds = useMemo(
    () => (products ?? []).filter((p) => p.is_featured_menu).map((p) => p.id),
    [products]
  )
  const initialFeaturedTexts = useMemo(() => {
    const m: Record<number, string> = {}
    for (const p of products ?? []) {
      if (p.is_featured_menu) m[p.id] = p.featured_text ?? ''
    }
    return m
  }, [products])
  const featuredChanged = useMemo(() => {
    if (featuredIds.length !== initialFeaturedIds.length) return true
    if (!featuredIds.every((id) => initialFeaturedIds.includes(id))) return true
    for (const id of featuredIds) {
      if ((featuredTexts[id] ?? '') !== (initialFeaturedTexts[id] ?? '')) return true
    }
    return false
  }, [featuredIds, featuredTexts, initialFeaturedIds, initialFeaturedTexts])
  const featuredLimitReached = featuredIds.length > 5

  const sameSet = (a: number[], b: number[]) =>
    a.length === b.length && a.every((x) => b.includes(x))

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Рекомендации
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Подборки товаров, которые публичный сайт показывает на главной и в листе избранного.
      </Typography.Paragraph>

      <Card
        title="Рекомендуем на главной"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveMenuRec.isPending}
            disabled={sameSet(menuRec, initialMenuRec)}
            onClick={() => saveMenuRec.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Горизонтальный скроллер над каталогом меню.
        </Typography.Paragraph>
        <Select
          mode="multiple"
          placeholder="Выберите товары"
          style={{ width: '100%' }}
          value={menuRec}
          onChange={setMenuRec}
          options={productOptions}
          optionFilterProp="label"
          showSearch
          maxTagCount="responsive"
        />
      </Card>

      <Card
        title="Наши новинки"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveFeatured.isPending}
            disabled={!featuredChanged || featuredLimitReached}
            onClick={() => saveFeatured.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Большая карточка-баннер на главной — листающаяся, до 5 товаров. Авто-перелистывание раз в 7 секунд.
        </Typography.Paragraph>
        <Select
          mode="multiple"
          placeholder="Выберите до 5 товаров"
          style={{ width: '100%' }}
          value={featuredIds}
          onChange={(v) => setFeaturedIds(v as number[])}
          options={productOptions}
          optionFilterProp="label"
          showSearch
          maxTagCount="responsive"
          status={featuredLimitReached ? 'error' : undefined}
        />
        {featuredLimitReached && (
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 4 }}>
            Можно выбрать не больше 5 товаров.
          </Typography.Text>
        )}
        {featuredIds.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {featuredIds.map((id) => {
              const p = (products ?? []).find((x) => x.id === id)
              return (
                <div key={id}>
                  <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
                    {p?.name ?? `Товар #${id}`}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                    Текст под названием (показывается на баннере)
                  </Typography.Text>
                  <Input.TextArea
                    value={featuredTexts[id] ?? ''}
                    onChange={(e) =>
                      setFeaturedTexts((prev) => ({ ...prev, [id]: e.target.value }))
                    }
                    rows={2}
                    maxLength={200}
                    placeholder="Например: слоёный, на французском масле"
                    showCount
                  />
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card
        title="Рекомендуем в избранном"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveFavRec.isPending}
            disabled={sameSet(favRec, initialFavRec)}
            onClick={() => saveFavRec.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Блок «Попробуйте ещё» внизу листа избранного.
        </Typography.Paragraph>
        <Select
          mode="multiple"
          placeholder="Выберите товары"
          style={{ width: '100%' }}
          value={favRec}
          onChange={setFavRec}
          options={productOptions}
          optionFilterProp="label"
          showSearch
          maxTagCount="responsive"
        />
      </Card>
    </Space>
  )
}
