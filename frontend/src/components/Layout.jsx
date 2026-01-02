import React from 'react';
import { Outlet, Link } from 'react-router-dom';

function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-bold text-primary-600">
                VTuber DB
              </Link>
              <div className="hidden md:flex space-x-4">
                <Link to="/search" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md">
                  検索
                </Link>
                <Link to="/tags" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md">
                  タグ一覧
                </Link>
              </div>
            </div>
            <div>
              <Link to="/admin" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md">
                管理者
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-sm">
              © 2025 VTuber Database. All rights reserved.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              データはYouTube、Twitter、Twitchから収集されています
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
