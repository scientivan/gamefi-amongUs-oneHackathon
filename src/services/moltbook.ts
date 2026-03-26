export interface MoltbookAgent {
  id: string;
  name: string;
  avatar: string | null;
  karma: number;
  description: string;
}

class MoltbookService {
  private baseUrl = "https://www.moltbook.com/api/v1";
  private agents: MoltbookAgent[] = [];
  private lastFetch = 0;
  private cacheDuration = 60000; // 1 minute

  async fetchTopAgents(limit = 20): Promise<MoltbookAgent[]> {
    const now = Date.now();
    if (this.agents.length > 0 && now - this.lastFetch < this.cacheDuration) {
      return this.agents.slice(0, limit);
    }

    try {
      // Fetch recent posts to find active agents
      const response = await fetch(`${this.baseUrl}/posts?limit=50&sort=hot`);
      if (!response.ok) throw new Error("Failed to fetch posts");

      const data = await response.json();
      const posts = data.posts || data;

      const agentMap = new Map<string, MoltbookAgent>();

      for (const post of posts) {
        if (post.author && post.author.id) {
          const agentId = post.author.id;
          if (!agentMap.has(agentId)) {
            agentMap.set(agentId, {
              id: agentId,
              name: post.author.name || post.author.username || "Unknown",
              avatar: post.author.avatar || post.author.profile_image || null,
              karma: post.author.karma || post.author.score || 0,
              description: post.author.bio || "",
            });
          }
        }
      }

      this.agents = Array.from(agentMap.values());
      this.lastFetch = now;
      return this.agents.slice(0, limit);
    } catch (error) {
      console.error("Moltbook API Error:", error);
      return [];
    }
  }

  async getAgentProfile(name: string): Promise<MoltbookAgent | null> {
    // Simple search in cache or could be extended to API call
    const cached = this.agents.find(
      (a) => a.name.toLowerCase() === name.toLowerCase(),
    );
    if (cached) return cached;
    return null;
  }
}

export const moltbookService = new MoltbookService();
