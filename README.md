## Channel3 Take Home Assignment

Refer to the "Take-Home Engineering Assignment" for setup instructions.

Happy coding!

### Instructions for Running

1. Run the extractor 
```
uv run python main.py
```

2. Run the server
```
uv run uvicorn server:app --reload
```

3. Run the frontend
```
cd frontend && npm install && npm run dev
```

### System Design:

#### How would you scale this system from 5 products to 50 million?

The biggest architectural change I would make is moving from a single-process pipeline to a distributed one. Instead of processing everything at once with asyncio.gather, I would introduce a queue like Kafka between crawling and extraction so that crawled HTML can be published as messages and processed independently by worker pods. That makes it much easier to scale horizontally as product volume grows. I would also add a distributed crawler upstream, especially for JavaScript-rendered pages, with per-domain rate limiting and change detection so we only reprocess pages when something has actually changed. On the storage side, I would move away from products.json and store structured product data in PostgreSQL, while keeping images in object storage such as S3. That would give the system a more reliable foundation for concurrent writes, querying, and future search use cases.

#### What assumptions will scale, and what assumptions will not scale?
The part of the system I think will scale well is the layered extraction approach. Starting with structured sources such as JSON-LD, Open Graph tags, embedded JavaScript state, and only then falling back to visible page content is a good general strategy because it is stateless, parallelizable, and not tied to any one site. What will not scale well is relying on flat-file storage, integer product IDs, or making multiple unconditional LLM calls for every product. At larger volume, those choices become harder to maintain, more expensive, and more fragile. I would keep AI in the loop for the cases where simpler extraction methods do not return enough structured data, but I would not want the system to depend on repeated LLM calls for every product forever. Once enough labeled data exists, some of that repeated classification work could be replaced with a dedicated classifier.

#### What API would you provide to power agentic shopping apps?
I would design the API around how an agent actually shops rather than around the underlying database structure. The core endpoint would be a semantic search API that accepts natural language queries and combines embedding-based retrieval with structured filters like price, brand, category, and availability. That would let an agent ask for something like “waterproof hiking boots under $150” without needing to know the internal taxonomy ahead of time. I would also add a batch retrieval endpoint so agents can fetch multiple products at once for ranking, comparison, or shortlist flows without making repeated one-by-one requests. If I were productizing it further, I would also expose the catalog through an MCP server so LLM-based agents could call product search and retrieval as native tools.

#### What other tools would you provide developers to help power new shopping experiences?
I would want to make the developer experience as smooth as possible, so I would provide typed Python and TypeScript SDKs with retry logic, pagination, and simple wrappers over the core API. I would also add webhooks for events like price drops and back-in-stock updates, since those are useful for shopping assistants that need to monitor products over time. Finally, I would include a sandbox catalog with synthetic test products that cover edge cases like multiple variants, missing images, sale prices, and out-of-stock inventory. That would give developers a safe way to build and test new shopping flows without depending on production data.