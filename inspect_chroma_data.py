import chromadb
import json

def inspect_data():
    try:
        # 1. Connect to the database
        print("Connecting to ChromaDB at './chroma_db'...")
        client = chromadb.PersistentClient(path="chroma_db")
        
        # 2. List all collections (documents)
        collections = client.list_collections()
        num_cols = len(collections)
        print(f"✅ Found {num_cols} collections (documents).\n")
        
        if num_cols == 0:
            print("Database is empty.")
            return

        # 3. Iterate through collections and show data
        for i, col in enumerate(collections):
            print(f"📂 Collection {i+1}: {col.name}")
            print(f"   - Item Count: {col.count()}")
            
            # Peek at the first item
            data = col.peek(limit=1)
            
            if data['ids']:
                first_id = data['ids'][0]
                first_doc = data['documents'][0]
                # Embeddings are lists of floats
                first_emb = data['embeddings'][0] if data['embeddings'] else []
                
                print("   - Sample Chunk Data:")
                display_obj = {
                    "id": first_id,
                    "document": first_doc[:100] + "..." if len(first_doc) > 100 else first_doc, # Truncate text for display
                    "embedding_length": len(first_emb),
                    "embedding_preview": first_emb[:5] + ["... (379 more)"] # Show just start
                }
                print(json.dumps(display_obj, indent=6))
                print("-" * 50)
            else:
                print("   - (Empty collection)")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    inspect_data()
