export class TestClass {
  async getChannelVideos(channelId, maxResults) {
    maxResults = maxResults || 5;
    return { channelId, maxResults };
  }
}
