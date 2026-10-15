"use client";

import { useState } from "react";

export default function DatabaseTestPage() {
  const [result, setResult] = useState<string>("");

  async function testDatabase() {
    setResult("Testing database connection...");

    try {
      const response = await fetch("/api/db-test");
      const data = await response.json();

      if (data.success) {
        setResult(`✅ ${data.message}`);
      } else {
        setResult(`❌ ${data.message}\n\n${data.error}`);
      }
    } catch (error) {
      setResult(
        `❌ Request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold">
          PostgreSQL Database Test
        </h1>

        <p className="mb-6 text-gray-600">
          Test the connection between Next.js, Prisma and PostgreSQL.
        </p>

        <button
          onClick={testDatabase}
          className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
        >
          Test Database Connection
        </button>

        {result && (
          <pre className="mt-6 whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-sm">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}