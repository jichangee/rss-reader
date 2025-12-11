import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * 获取个性化推荐文章
 * GET /api/square/recommended
 * 
 * 推荐算法：
 * 1. 分析用户已订阅Feed的主题特征
 * 2. 找出用户最常阅读/收藏的Feed
 * 3. 推荐同类热门Feed中的热门文章
 * 4. 排除用户已订阅的Feed
 * 
 * Query参数:
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        feeds: {
          select: {
            url: true,
            id: true
          }
        },
        readArticles: {
          orderBy: { readAt: 'desc' },
          take: 50, // 分析最近50篇阅读记录
          include: {
            article: {
              include: {
                feed: {
                  select: {
                    id: true,
                    url: true
                  }
                }
              }
            }
          }
        },
        readLater: {
          orderBy: { addedAt: 'desc' },
          take: 50, // 分析最近50个稍后读
          include: {
            article: {
              include: {
                feed: {
                  select: {
                    id: true,
                    url: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")))
    const skip = (page - 1) * limit

    // 用户已订阅的Feed URL
    const subscribedUrls = new Set(user.feeds.map(f => f.url))

    // 如果用户没有订阅任何Feed，返回全局热门
    if (user.feeds.length === 0) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const trendingArticles = await prisma.articleHotness.findMany({
        where: {
          article: {
            createdAt: { gte: thirtyDaysAgo }
          },
          hotScore: { gt: 0 }
        },
        include: {
          article: {
            include: {
              feed: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  imageUrl: true
                }
              }
            }
          }
        },
        orderBy: { hotScore: 'desc' },
        skip,
        take: limit
      })

      return NextResponse.json({
        articles: trendingArticles.map(h => ({
          id: h.article.id,
          title: h.article.title,
          link: h.article.link,
          contentSnippet: h.article.contentSnippet,
          pubDate: h.article.pubDate,
          feed: h.article.feed,
          hotness: {
            readLaterCount: h.readLaterCount,
            readCount: h.readCount,
            uniqueUsers: h.uniqueUsers,
            hotScore: h.hotScore
          },
          isSubscribed: false,
          isReadLater: false,
          isRead: false
        })),
        reason: "新用户推荐",
        pagination: {
          page,
          limit,
          hasMore: trendingArticles.length === limit
        }
      })
    }

    // 分析用户的阅读偏好（最常阅读的Feed）
    const feedInteractionCount = new Map<string, number>()
    
    user.readArticles.forEach(ra => {
      const feedId = ra.article.feed.id
      feedInteractionCount.set(feedId, (feedInteractionCount.get(feedId) || 0) + 1)
    })
    
    user.readLater.forEach(rl => {
      const feedId = rl.article.feed.id
      // 稍后读权重更高
      feedInteractionCount.set(feedId, (feedInteractionCount.get(feedId) || 0) + 2)
    })

    // 获取用户最喜欢的Feed ID列表
    const favoriteFeedIds = Array.from(feedInteractionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([feedId]) => feedId)

    // 如果没有互动记录，使用用户订阅的所有Feed
    const targetFeedIds = favoriteFeedIds.length > 0 
      ? favoriteFeedIds 
      : user.feeds.map(f => f.id)

    // 找出这些Feed的相似特征（通过共同订阅者找相似Feed）
    // 简化版：找出订阅了相似Feed的其他用户，看他们还订阅了什么
    const similarUsers = await prisma.user.findMany({
      where: {
        feeds: {
          some: {
            id: { in: targetFeedIds }
          }
        },
        id: { not: user.id }
      },
      include: {
        feeds: {
          select: {
            url: true,
            id: true
          }
        }
      },
      take: 20 // 找20个相似用户
    })

    // 统计相似用户订阅的Feed（排除用户已订阅的）
    const recommendedFeedUrls = new Map<string, number>()
    similarUsers.forEach(simUser => {
      simUser.feeds.forEach(feed => {
        if (!subscribedUrls.has(feed.url)) {
          recommendedFeedUrls.set(feed.url, (recommendedFeedUrls.get(feed.url) || 0) + 1)
        }
      })
    })

    // 获取推荐分最高的Feed URL
    const topRecommendedUrls = Array.from(recommendedFeedUrls.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url]) => url)

    // 如果没有找到推荐Feed，降级到热门Feed
    if (topRecommendedUrls.length === 0) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const hotArticles = await prisma.articleHotness.findMany({
        where: {
          article: {
            createdAt: { gte: thirtyDaysAgo },
            feed: {
              url: { notIn: Array.from(subscribedUrls) }
            }
          },
          hotScore: { gt: 0 }
        },
        include: {
          article: {
            include: {
              feed: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  imageUrl: true
                }
              }
            }
          }
        },
        orderBy: { hotScore: 'desc' },
        skip,
        take: limit
      })

      return NextResponse.json({
        articles: hotArticles.map(h => ({
          id: h.article.id,
          title: h.article.title,
          link: h.article.link,
          contentSnippet: h.article.contentSnippet,
          pubDate: h.article.pubDate,
          feed: h.article.feed,
          hotness: {
            readLaterCount: h.readLaterCount,
            readCount: h.readCount,
            uniqueUsers: h.uniqueUsers,
            hotScore: h.hotScore
          },
          isSubscribed: false,
          isReadLater: false,
          isRead: false
        })),
        reason: "热门推荐",
        pagination: {
          page,
          limit,
          hasMore: hotArticles.length === limit
        }
      })
    }

    // 从推荐的Feed中获取热门文章
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recommendedArticles = await prisma.articleHotness.findMany({
      where: {
        article: {
          createdAt: { gte: thirtyDaysAgo },
          feed: {
            url: { in: topRecommendedUrls }
          }
        },
        hotScore: { gt: 0 }
      },
      include: {
        article: {
          include: {
            feed: {
              select: {
                id: true,
                title: true,
                url: true,
                imageUrl: true
              }
            },
            readBy: {
              where: { userId: user.id }
            },
            readLaterBy: {
              where: { userId: user.id }
            }
          }
        }
      },
      orderBy: { hotScore: 'desc' },
      skip,
      take: limit
    })

    return NextResponse.json({
      articles: recommendedArticles.map(h => ({
        id: h.article.id,
        title: h.article.title,
        link: h.article.link,
        contentSnippet: h.article.contentSnippet,
        pubDate: h.article.pubDate,
        feed: h.article.feed,
        hotness: {
          readLaterCount: h.readLaterCount,
          readCount: h.readCount,
          uniqueUsers: h.uniqueUsers,
          hotScore: h.hotScore
        },
        isSubscribed: false,
        isReadLater: h.article.readLaterBy.length > 0,
        isRead: h.article.readBy.length > 0
      })),
      reason: "基于您的阅读偏好",
      pagination: {
        page,
        limit,
        hasMore: recommendedArticles.length === limit
      }
    })
  } catch (error) {
    console.error("获取个性化推荐失败:", error)
    return NextResponse.json(
      { 
        error: "获取推荐失败",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
