import { useEffect, useState } from "preact/hooks";
import { loadHomeData } from "./loadData";
import { normalizeData } from "./normalize";

export function useCatalog() {
  const [model, setModel] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadHomeData()
      .then((data) => setModel(normalizeData(data)))
      .catch((reason) => setError(reason.message));
  }, []);

  return { model, error };
}
