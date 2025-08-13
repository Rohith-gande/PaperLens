const axios = require("axios");

async function fetchPapers(topic) {
    try {
        const query = encodeURIComponent(topic);
        const url = `http://export.arxiv.org/api/query?search_query=all:${query}&start=0&max_results=5`;

        const { data } = await axios.get(url);
        return data; 
    } catch (error) {
        console.error("Error fetching papers:", error);
        return null;
    }
}

module.exports = { fetchPapers };
