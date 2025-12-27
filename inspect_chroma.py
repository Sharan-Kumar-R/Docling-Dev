import chromadb

def inspect_db():
    try:
        client = chromadb.PersistentClient(path="chroma_db")
        collections = client.list_collections()
        
        print(f"Found {len(collections)} collections.")
        
        if collections:
            # Inspect the first collection
            col = collections[0]
            print(f"\nInspecting Collection: {col.name}")
            
            # Peel into the collection (get first 2 items)
            # We don't need embeddings for visual inspection as they are just long arrays
            data = col.peek(limit=2)
            
            if data and data['ids']:
                print(f"Number of items in collection: {col.count()}")
                print("\nSample Data (First 2 chunks):")
                
                import json
                
                # Get just the first item
                first_id = data['ids'][0]
                first_doc = data['documents'][0]
                first_emb = data['embeddings'][0] if data['embeddings'] else []
                
                # Construct the object user wants to see
                display_obj = {
                    "id": first_id,
                    "document": first_doc,
                    "embedding": first_emb  # This will print the full list of floats
                }
                
                print("\nHere is the ACTUAL data stored for the first chunk:")
                print(json.dumps(display_obj, indent=2))

                        
            else:
                print("Collection is empty.")
        else:
            print("No collections found in the database. (Upload a document first to see structure)")

    except Exception as e:
        print(f"Error inspecting DB: {e}")

if __name__ == "__main__":
    inspect_db()
