<script lang="ts">
  import Editor from '../components/Editor.svelte';
  import { openFileInTab } from '../lib/stores';

  // 動作確認用に、ダミーのファイルを開く関数
  function testOpenFile() {
    openFileInTab(
      '/path/to/dummy.md', 
      'テストファイル.md', 
      '# テスト\n\nこれは**テスト用**のファイルです。\n\n![[test-image.png]]\n\n編集ボタンを押して書き換えてみてください。'
    );
  }
</script>

<main class="h-screen w-screen flex bg-gray-100">
  
  <!-- 左側のサイドバー（仮） -->
  <div class="w-64 bg-white border-r flex flex-col">
    <div class="p-4 border-b font-bold text-gray-700">
      ワークスペース
    </div>
    <div class="p-4">
      <p class="text-sm text-gray-500 mb-4">
        ここに抽出したファイルのリストが並びます。
      </p>
      <button 
        class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
        on:click={testOpenFile}
      >
        テストファイルを開く
      </button>
    </div>
  </div>

  <!-- 右側のエディタエリア -->
  <div class="flex-1 overflow-hidden">
    <!-- さきほど作ったコンポーネントをここに読み込む -->
    <Editor />
  </div>

</main>
