// test-class.js
var TestClass = class {
  async getChannelVideos(channelId, maxResults) {
    maxResults = maxResults || 5;
    return { channelId, maxResults };
  }
};
export {
  TestClass
};
